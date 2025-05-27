from flask import Flask, render_template, request, redirect, url_for, session, flash, jsonify, render_template_string
from flask_mysqldb import MySQL
from flask_cors import CORS  # Import Flask-CORS
import MySQLdb.cursors
import re
from werkzeug.security import generate_password_hash, check_password_hash
from urllib.parse import quote
import datetime

from flask_mail import Mail, Message
from itsdangerous import URLSafeTimedSerializer, SignatureExpired
from pyotp import TOTP
import base64
import os
import sys
from dotenv import load_dotenv
import requests

load_dotenv()  # This loads the environment variables from a .env file

app = Flask(__name__)

# Enable CORS for all routes
CORS(app)  # Add this line to enable CORS

def generate_base32_secret_key():
    # Generate a random 20-byte key
    secret_key = os.urandom(20)
    # Base32 encode the key
    base32_secret_key = base64.b32encode(secret_key).decode('utf-8')
    return base32_secret_key


# Database and secret key configurations
app.config['SECRET_KEY'] = generate_base32_secret_key()
# app.config['MYSQL_HOST'] = 'localhost'
# app.config['MYSQL_USER'] = 'root'
# app.config['MYSQL_PASSWORD'] = ''
# app.config['MYSQL_DB'] = 'linkedin_commenter_draft'

# # Email configurations
# app.config['MAIL_SERVER'] = 'smtp.gmail.com'
# app.config['MAIL_PORT'] = 465
# app.config['MAIL_USE_SSL'] = True
# app.config['MAIL_USERNAME'] = 'utsho008800@gmail.com'
# app.config['MAIL_PASSWORD'] = 'kjfm hcbw tdii dkha'

app.config['MYSQL_HOST'] = os.getenv('MYSQL_HOST')
app.config['MYSQL_USER'] = os.getenv('MYSQL_USER')
app.config['MYSQL_PASSWORD'] = os.getenv('MYSQL_PASSWORD')
app.config['MYSQL_DB'] = os.getenv('MYSQL_DB')

# Email configurations
app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER')
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT'))
app.config['MAIL_USE_SSL'] = os.getenv('MAIL_USE_SSL').lower() in ['true', '1', 't']
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD')

mail = Mail(app)

s = URLSafeTimedSerializer(app.config['SECRET_KEY'])

mysql = MySQL(app)

def load_disposable_domains():
    blacklist_path = os.path.join(os.path.dirname(__file__), 'disposable_email_blocklist.conf')
    if not os.path.exists(blacklist_path):
        # Download the list if not present
        url = 'https://raw.githubusercontent.com/disposable-email-domains/disposable-email-domains/master/disposable_email_blocklist.conf'
        response = requests.get(url)
        with open(blacklist_path, 'w', encoding='utf-8') as f:
            f.write(response.text)
    with open(blacklist_path, 'r', encoding='utf-8') as f:
        return set(line.strip() for line in f if line.strip() and not line.startswith('#'))

DISPOSABLE_DOMAINS = load_disposable_domains()

def is_disposable_email(email):
    domain = email.split('@')[-1].lower()
    return domain in DISPOSABLE_DOMAINS

@app.route('/')
def home():
    if 'email' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        full_name = request.form['full_name']
        email = request.form['email']
        password = request.form['password']

        # Store ext_id from the query parameters if present
        extension_id = request.args.get('ext_id', None)

        # Block disposable email addresses
        if is_disposable_email(email):
            flash('Disposable email addresses are not allowed. Please use a real email.', 'danger')
            return redirect(url_for('register', ext_id=extension_id))

        # Input validation
        if not re.match(r'[A-Za-z0-9]+', full_name) or not re.match(r'[^@]+@[^@]+\.[^@]+', email):
            flash('Invalid input!', 'danger')
            return redirect(url_for('register', ext_id=extension_id))

        cursor = mysql.connection.cursor()
        cursor.execute('SELECT * FROM user WHERE email = %s', (email,))
        if cursor.fetchone():
            flash('Account already exists!', 'danger')
            return redirect(url_for('register', ext_id=extension_id))

        # Generate OTP and prepare it for sending
        otp = TOTP(app.config['SECRET_KEY']).now()
        session['otp'] = otp
        session['email'] = email
        session['full_name'] = full_name
        session['password'] = generate_password_hash(password, method='scrypt')

        # Render and send HTML email
        html_content = render_template('otp_email.html', full_name=full_name, otp=otp)
        msg = Message('Verify Your Account', sender=app.config['MAIL_USERNAME'], recipients=[email])
        msg.html = html_content
        mail.send(msg)

        return redirect(url_for('verify_otp', ext_id=extension_id))

    return render_template('register.html')




@app.route('/send_otp', methods=['POST'])
def send_otp():
    email = request.form['email']

    # Retrieve full_name from the database
    cursor = mysql.connection.cursor()
    cursor.execute('SELECT full_name FROM user WHERE email = %s', (email,))
    user = cursor.fetchone()
    if not user:
        flash('No account associated with this email.', 'danger')
        return redirect(url_for('register'))  # or any other appropriate route

    full_name = user['full_name']
    otp = TOTP(app.config['SECRET_KEY']).now()

    # Render the OTP email template
    html_content = render_template('otp_email.html', full_name=full_name, otp=otp)
    msg = Message('Your OTP', sender=app.config['MAIL_USERNAME'], recipients=[email])
    msg.html = html_content
    mail.send(msg)

    flash('OTP sent to your email.', 'info')
    return redirect(url_for('verify_otp'))


@app.route('/verify_otp', methods=['GET', 'POST'])
def verify_otp():
    extension_id = request.args.get('ext_id', None)  # Get ext_id from URL or session

    if request.method == 'POST':
        # Check for action to resend OTP
        if request.form.get('action') == 'resend':
            # Resend OTP logic
            email = session.get('email')
            full_name = session.get('full_name')

            if email and full_name:
                # Generate a new OTP
                otp = TOTP(app.config['SECRET_KEY']).now()
                session['otp'] = otp  # Update the session with the new OTP

                # Render the OTP email template
                html_content = render_template('otp_email.html', full_name=full_name, otp=otp)
                msg = Message('Your OTP', sender=app.config['MAIL_USERNAME'], recipients=[email])
                msg.html = html_content
                mail.send(msg)

                flash('OTP resent to your email.', 'info')
            else:
                flash('Unable to resend OTP. Please try again.', 'danger')
            return redirect(url_for('verify_otp', ext_id=extension_id))  # Redirect to the same page to show the message

        # If action is not resend, process the OTP verification
        user_otp = request.form['otp']  # This will only be accessed if it's not a resend action
        if 'otp' in session and user_otp == session['otp']:
            cursor = mysql.connection.cursor()
            cursor.execute('INSERT INTO user (full_name, email, password) VALUES (%s, %s, %s)', 
                           (session['full_name'], session['email'], session['password']))
            mysql.connection.commit()

            # Clear session variables after successful registration
            session.pop('otp', None)
            session.pop('email', None)
            session.pop('full_name', None)
            session.pop('password', None)

            flash('Registered successfully! Please login.', 'success')
            return redirect(url_for('login', ext_id=extension_id))  # Pass the ext_id to login
        else:
            flash('Invalid OTP, please try again.', 'danger')

    return render_template('verify_otp.html', ext_id=extension_id)


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']
        
        cursor = mysql.connection.cursor(MySQLdb.cursors.DictCursor)
        cursor.execute('SELECT * FROM user WHERE email = %s', (email,))
        account = cursor.fetchone()

        if not account:
            flash('No account found with this email address.', 'danger')
            return render_template('login.html', ext_id=request.args.get('ext_id', ''))

        if not check_password_hash(account['password'], password):
            flash('Incorrect password. Please try again.', 'danger')
            return render_template('login.html', ext_id=request.args.get('ext_id', ''))

            # Successful login
            session['email'] = email
            session['full_name'] = account['full_name']
            session['user_id'] = account['Id']  # Store user ID in session
            
            # Retrieve extension ID from the query string, not from form data
            extension_id = request.args.get('ext_id', None)
            if extension_id:
                # If logged in via extension, redirect to a custom extension URL
                full_name_encoded = quote(account['full_name'])
                user_id = account['Id']
                today = datetime.date.today()
                cursor.execute('SELECT request_count FROM daily_usage WHERE user_id = %s AND date = %s', (user_id, today))
                usage = cursor.fetchone()
                request_count = usage['request_count'] if usage else 0

                # Redirect to an extension-specific URL with necessary parameters
                return redirect(f'http://{extension_id}.chromiumapp.org/?name={full_name_encoded}&user_id={user_id}&request_count={request_count}')
            else:
                # Regular web login, redirect to dashboard
                return redirect(url_for('dashboard'))

    # GET request
    return render_template('login.html', ext_id=request.args.get('ext_id', ''))




@app.route('/forgot_password', methods=['GET', 'POST'])
def forgot_password():
    if request.method == 'POST':
        email = request.form['email']
        cursor = mysql.connection.cursor(MySQLdb.cursors.DictCursor)
        cursor.execute('SELECT full_name FROM user WHERE email = %s', (email,))
        user = cursor.fetchone()
        if user:
            token = s.dumps(email, salt='email-reset')
            link = url_for('reset_password', token=token, _external=True)
            html_content = render_template('password_reset_email.html', link=link, full_name=user['full_name'])
            msg = Message('Reset Your Password', sender='utsho008800@gmail.com', recipients=[email])
            msg.html = html_content  # Set the HTML content
            mail.send(msg)
            flash('A password reset email has been sent.', 'info')
        else:
            flash('This email is not registered.', 'danger')
        return redirect(url_for('forgot_password'))
    return render_template('forgot_password.html')


@app.route('/reset_password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    try:
        email = s.loads(token, salt='email-reset', max_age=3600)
    except SignatureExpired:
        flash('The reset link has expired. Please try resetting your password again.', 'danger')
        return redirect(url_for('forgot_password'))
    except:
        flash('Invalid or expired token. Please try again.', 'danger')
        return redirect(url_for('forgot_password'))

    if request.method == 'POST':
        password = request.form['password']
        confirm_password = request.form['confirm_password']
        if password != confirm_password:
            flash('Passwords do not match. Please try again.', 'danger')
            return render_template('reset_password.html', token=token)

        hashed_password = generate_password_hash(password, method='scrypt')
        cursor = mysql.connection.cursor(MySQLdb.cursors.DictCursor)
        cursor.execute('UPDATE user SET password = %s WHERE email = %s', (hashed_password, email))
        mysql.connection.commit()
        flash('Your password has been updated successfully!', 'success')
        return redirect(url_for('login'))

    return render_template('reset_password.html', token=token)



@app.route('/get_comments/<int:user_id>', methods=['GET'])
def get_comments(user_id):
    cursor = mysql.connection.cursor(MySQLdb.cursors.DictCursor)
    cursor.execute('SELECT post_text, generated_comment, emotion, created_at FROM comments_history WHERE user_id = %s ORDER BY created_at DESC',
                   (user_id,))
    comments = cursor.fetchall()
    return jsonify(comments), 200

@app.route('/get_comments_top5/<int:user_id>', methods=['GET'])
def get_comments_top5(user_id):
    cursor = mysql.connection.cursor(MySQLdb.cursors.DictCursor)
    cursor.execute('SELECT post_text, generated_comment, emotion, created_at FROM comments_history WHERE user_id = %s ORDER BY created_at DESC LIMIT 5', 
                   (user_id,))
    comments = cursor.fetchall()
    return jsonify(comments), 200

@app.route('/get_comment_count/<int:user_id>', methods=['GET'])
def get_comment_count(user_id):
    try:
        cursor = mysql.connection.cursor(MySQLdb.cursors.DictCursor)
        
        # Count total comments generated by the specific user
        cursor.execute('SELECT COUNT(*) AS total_comments FROM comments_history WHERE user_id = %s', (user_id,))
        result = cursor.fetchone()
        cursor.close()
        
        total_comments = result['total_comments'] if result else 0
        return jsonify({"total_comments": total_comments}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/get_request_count/<int:user_id>', methods=['GET'])
def get_request_count(user_id):
    today = datetime.date.today()
    
    try:
        with mysql.connection.cursor(MySQLdb.cursors.DictCursor) as cursor:
            # Fetch the user's full name
            cursor.execute('SELECT full_name FROM user WHERE Id = %s', (user_id,))
            user = cursor.fetchone()

            # If user not found, return an error
            if not user:
                return jsonify({"error": "User not found"}), 404

            # Fetch the latest request count for the current day
            cursor.execute('SELECT request_count FROM daily_usage WHERE user_id = %s AND date = %s', (user_id, today))
            usage = cursor.fetchone()

            # Set request count to 0 if no usage data for today
            request_count = usage['request_count'] if usage else 0

            # Return both the full name and request count
            return jsonify({
                "full_name": user['full_name'],
                "request_count": request_count
            }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500  # Return an error response



@app.route('/dashboard')
def dashboard():
    if 'user_id' in session:
        user_id = session['user_id']

        # Fetch user's full name
        cursor = mysql.connection.cursor(MySQLdb.cursors.DictCursor)
        cursor.execute("SELECT full_name FROM user WHERE id = %s", (user_id,))
        user = cursor.fetchone()
        
        # Fetch request count
        today = datetime.date.today()
        cursor.execute('SELECT request_count FROM daily_usage WHERE user_id = %s AND date = %s', (user_id, today))
        daily_usage = cursor.fetchone()

        # Fetch total comments
        cursor.execute("SELECT COUNT(*) AS total_comments FROM comments_history WHERE user_id = %s", (user_id,))
        comments_count = cursor.fetchone()

        cursor.close()

        # Extract the necessary information
        full_name = user['full_name'] if user else "Guest"
        request_count = daily_usage['request_count'] if daily_usage else 0
        total_comments = comments_count['total_comments'] if comments_count else 0

        # Pass the information to the dashboard template
        return render_template('dashboard.html', user_id=user_id, full_name=full_name, request_count=request_count, total_comments=total_comments, active_page='dashboard')

    # Redirect to login if not logged in
    return redirect('/login')

@app.route("/table")
def table():
    if 'user_id' in session:
        user_id = session['user_id']
        return render_template('table.html', user_id=user_id, active_page='table')
    return redirect('/login')  # Redirect if not logged in

@app.route("/billing")
def billing():
    return render_template("billing.html", active_page='billing')

@app.route("/notifications")
def notifications():
    return render_template("notifications.html", active_page='notifications')

@app.route("/profile", methods=['GET', 'POST'])
def profile():
    # Ensure user is logged in
    if 'user_id' not in session:
        return redirect(url_for('login'))

    user_id = session['user_id']
    cursor = mysql.connection.cursor(MySQLdb.cursors.DictCursor)

    if request.method == 'POST':
        # Get form data
        new_name = request.form['name']
        new_password = request.form['password']
        confirm_password = request.form['confirm_password']

        # Flag to check if the profile was updated
        profile_updated = False

        # Update user name
        if new_name and new_name != session['full_name']:  # Only update if the name has changed
            cursor.execute('UPDATE user SET full_name = %s WHERE Id = %s', (new_name, user_id))
            profile_updated = True  # Mark that the profile was updated
        
        # Update password if provided and confirmed
        if new_password:
            if new_password == confirm_password:
                hashed_password = generate_password_hash(new_password)
                cursor.execute('UPDATE user SET password = %s WHERE Id = %s', (hashed_password, user_id))
                profile_updated = True  # Mark that the profile was updated
            else:
                flash('Passwords do not match!', 'danger')
                return render_template('profile.html', current_user={'full_name': session['full_name']})

        mysql.connection.commit()

        # Flash message if the profile was updated
        if profile_updated:
            flash('Profile updated successfully!', 'success')
            session['full_name'] = new_name  # Update session data if name changed

    # Fetch current user info
    cursor.execute('SELECT full_name FROM user WHERE Id = %s', (user_id,))
    user = cursor.fetchone()
    cursor.close()

    # Pass user info to the template
    return render_template('profile.html', current_user=user, active_page='profile')

@app.route('/logout')
def logout():
    # session.pop('email', None)
    # session.pop('full_name', None)
    # session.pop('user_id', None)  # Clear user ID from session
    session.clear()
    return redirect(url_for('login'))

@app.route('/log_comment', methods=['POST'])
def log_comment():
    data = request.json
    cursor = mysql.connection.cursor(MySQLdb.cursors.DictCursor)
    cursor.execute('INSERT INTO comments_history (user_id, post_text, generated_comment, emotion) VALUES (%s, %s, %s, %s)',
                   (data['user_id'], data['post_text'], data['generated_comment'], data['emotion']))
    mysql.connection.commit()
    return jsonify({"message": "Comment logged successfully"}), 200

# @app.route('/get_comments/<int:user_id>', methods=['GET'])
# def get_comments(user_id):
#     cursor = mysql.connection.cursor(MySQLdb.cursors.DictCursor)
#     cursor.execute('SELECT post_text, generated_comment, emotion, created_at FROM comments_history WHERE user_id = %s ORDER BY created_at DESC',
#                    (user_id,))
#     comments = cursor.fetchall()
#     return jsonify(comments), 200


# This route checks and updates daily usage limits for each user
@app.route('/check_usage', methods=['POST'])
def check_usage():
    data = request.json
    user_id = data['user_id']  # Get the user_id from the request

    if not user_id:
        return jsonify({"error": "User ID is missing"}), 400

    today = datetime.date.today()

    # Check usage for today
    cursor = mysql.connection.cursor(MySQLdb.cursors.DictCursor)
    cursor.execute('SELECT * FROM daily_usage WHERE user_id = %s AND date = %s', (user_id, today))
    usage = cursor.fetchone()

    if usage:
        if usage['request_count'] >= 10:  # Assuming 10 is the daily limit
            return jsonify({"error": "Daily limit reached", "request_count": usage['request_count']}), 429
        
        # Otherwise, increment the request count
        cursor.execute('UPDATE daily_usage SET request_count = request_count + 1 WHERE user_id = %s AND date = %s', (user_id, today))
        new_request_count = usage['request_count'] + 1
    else:
        # If no entry exists for today, create a new record and set the request count to 1
        cursor.execute('INSERT INTO daily_usage (user_id, date, request_count) VALUES (%s, %s, 1)', (user_id, today))
        new_request_count = 1

    mysql.connection.commit()

    # Return the updated request count in the response
    return jsonify({"message": "Usage updated", "request_count": new_request_count}), 200


# ========Practice Sction=========
@app.route('/api/select-plan/pro', methods=['GET'])
def select_pro_plan():
    return jsonify(message="Pro Plan accepted")

@app.route('/api/select-plan/pro-max', methods=['GET'])
def select_pro_max_plan():
    return jsonify(message="Pro Max Plan accepted")


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
