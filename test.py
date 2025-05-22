@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']

        cursor = mysql.connection.cursor(MySQLdb.cursors.DictCursor)
        cursor.execute('SELECT * FROM user WHERE email = %s', (email,))
        account = cursor.fetchone()

        if account and check_password_hash(account['password'], password):
            session['email'] = email
            session['full_name'] = account['full_name']
            session['user_id'] = account['Id']  # Store user ID in session

            extension_id = request.args.get('ext_id', None)  # Get ext_id parameter from the URL query
            if extension_id:  # Check if the login is via the extension
                full_name_encoded = quote(account['full_name'])
                user_id = account['Id']
                today = datetime.date.today()
                cursor.execute('SELECT request_count FROM daily_usage WHERE user_id = %s AND date = %s', (user_id, today))
                usage = cursor.fetchone()
                request_count = usage['request_count'] if usage else 0

                # Redirect to the custom extension URL with necessary parameters
                return redirect(f'http://{extension_id}.chromiumapp.org/?name={full_name_encoded}&user_id={user_id}&request_count={request_count}')
            else:
                # Redirect to the dashboard for a normal web login
                return redirect(url_for('dashboard'))
        else:
            flash('Invalid login attempt.', 'danger')
    return render_template('login.html')