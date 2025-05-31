#!/usr/bin/env bash

echo "Now in entrypoint.sh for Firefly III"
echo ""
echo "Script:            2.0 (2024-11-24)"
echo "User:              $(whoami || echo 'unknown')"
echo "Group:             $(id -g -n)"
echo "Working dir:       $(pwd)"
echo "Base build number: $BASE_IMAGE_BUILD"
echo "Base build date:   $BASE_IMAGE_DATE"
echo "Build number:      $(cat /var/www/counter-main.txt)"
echo "Build date:        $(cat /var/www/build-date-main.txt)"
echo ""

#
# Echo with [i]
#
infoLine () {
        echo "  [i] $1"
}
#
# Echo with [✓]
#
positiveLine () {
        echo "  [✓] $1"
}

#
# echo with [!]
#
warnLine () {
        echo "  [!] $1"
}

# https://github.com/docker-library/wordpress/blob/master/docker-entrypoint.sh
# usage: file_env VAR [DEFAULT]
#    ie: file_env 'XYZ_DB_PASSWORD' 'example'
# (will allow for "$XYZ_DB_PASSWORD_FILE" to fill in the value of
#  "$XYZ_DB_PASSWORD" from a file, especially for Docker's secrets feature)
file_env() {
	local var="$1"
	local fileVar="${var}_FILE"
	local def="${2:-}"
	if [ "${!var:-}" ] && [ "${!fileVar:-}" ]; then
		echo >&2 "error: both $var and $fileVar are set (but are exclusive)"
		exit 1
	fi
	local val="$def"
	if [ "${!var:-}" ]; then
		val="${!var}"
	elif [ "${!fileVar:-}" ]; then
		echo "$1 will be set from $fileVar"
		val="$(< "${!fileVar}")"
	fi
	export "$var"="$val"
	unset "$fileVar"
}
# envs that can be appended with _FILE
envs=(SITE_OWNER APP_KEY DB_CONNECTION DB_HOST	DB_PORT	DB_DATABASE	DB_USERNAME	DB_PASSWORD	PGSQL_SSL_MODE	PGSQL_SSL_ROOT_CERT	PGSQL_SSL_CERT	PGSQL_SSL_KEY	PGSQL_SSL_CRL_FILE	REDIS_HOST	REDIS_PASSWORD	REDIS_PORT	COOKIE_DOMAIN	MAIL_MAILER	MAIL_HOST	MAIL_PORT	MAIL_FROM	MAIL_USERNAME	MAIL_PASSWORD	MAIL_ENCRYPTION	MAILGUN_DOMAIN	MAILGUN_SECRET	MAILGUN_ENDPOINT	MANDRILL_SECRET	SPARKPOST_SECRET	MAPBOX_API_KEY	FIXER_API_KEY	LOGIN_PROVIDER	TRACKER_SITE_ID	TRACKER_URL	STATIC_CRON_TOKEN  PASSPORT_PRIVATE_KEY  PASSPORT_PUBLIC_KEY  MAILERSEND_API_KEY)

for e in "${envs[@]}"; do
  file_env "$e"
done

# touch DB file
if [[ $DKR_CHECK_SQLITE != "false" ]]; then
  if [[ $DB_CONNECTION == "sqlite" ]]; then
    touch $FIREFLY_III_PATH/storage/database/database.sqlite
    infoLine "Touched DB file for SQLite"
  fi
fi

# validate a bunch of environment variables and warn the user:
validate=(
	APP_KEY
	DB_CONNECTION
	DB_HOST
	DB_PORT
	DB_DATABASE
	DB_USERNAME
	DB_PASSWORD
	MAIL_MAILER
	MAIL_FROM
)
for v in "${validate[@]}"; do
  if [ -z "${!v}" ]; then
      warnLine "Environment variable $v is empty."
	fi
done

if [ -z "${SITE_OWNER}" ]; then
    warnLine "Environment variable SITE_OWNER is empty which means email notifications may not work as expected."
fi

echo ""

composer dump-autoload
php artisan package:discover

#infoLine "Current working dir is '$(pwd)'"
infoLine "Wait for the database. You may see an error about an 'aborted connection', this is normal."
if [[ -z "$DB_PORT" ]]; then
  if [[ $DB_CONNECTION == "pgsql" ]]; then
    DB_PORT=5432
  elif [[ $DB_CONNECTION == "mysql" ]]; then
    DB_PORT=3306
  fi
fi
if [[ -n "$DB_PORT" ]]; then
  /usr/local/bin/wait-for-it.sh "${DB_HOST}:${DB_PORT}" -t 60 -- echo "  [✓] DB is up."
fi

infoLine "Wait another 10 seconds in case the DB needs to boot."
sleep 10
positiveLine "Done waiting for the DB to boot."

infoLine 'Will run database commands.'
php artisan firefly-iii:create-database

infoLine 'Will run upgrade commands.'
php artisan firefly-iii:upgrade-database

php artisan firefly-iii:laravel-passport-keys
chmod 600 $FIREFLY_III_PATH/storage/oauth-public.key
chmod 600 $FIREFLY_III_PATH/storage/oauth-private.key

php artisan firefly-iii:set-latest-version --james-is-cool
php artisan cache:clear > /dev/null 2>&1
php artisan config:cache > /dev/null 2>&1

# set docker var.
export IS_DOCKER=true

php artisan firefly-iii:verify-security-alerts
php artisan firefly:instructions install

rm -rf $FIREFLY_III_PATH/storage/framework/cache/data/*
rm -f $FIREFLY_III_PATH/storage/logs/*.log
# chmod -R 775 $FIREFLY_III_PATH/storage
