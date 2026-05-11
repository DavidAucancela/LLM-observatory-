#!/bin/sh
# Substitute PORT, API_INTERNAL_URL and RESOLVER into nginx config at container start.
# RESOLVER is read from /etc/resolv.conf so it works in any environment (Railway, Docker, etc.)
RESOLVER=$(grep -m1 '^nameserver' /etc/resolv.conf | awk '{print $2}')
export RESOLVER
envsubst '$PORT $API_INTERNAL_URL $RESOLVER' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
