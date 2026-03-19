#!/bin/sh
# Substitute PORT and API_INTERNAL_URL into nginx config at container start.
# This allows Railway to inject $PORT dynamically without rebuilding the image.
envsubst '$PORT $API_INTERNAL_URL' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
