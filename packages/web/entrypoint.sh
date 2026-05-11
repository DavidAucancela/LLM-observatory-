#!/bin/sh
# Substitute PORT, API_INTERNAL_URL and RESOLVER into nginx config at container start.
# RESOLVER is read from /etc/resolv.conf; IPv6 addresses are wrapped in brackets for nginx.
NAMESERVER=$(grep -m1 '^nameserver' /etc/resolv.conf | awk '{print $2}')
case "$NAMESERVER" in
    *:*) RESOLVER="[$NAMESERVER]" ;;  # IPv6 — nginx requires brackets
    *)   RESOLVER="$NAMESERVER"   ;;  # IPv4 — use as-is
esac
export RESOLVER
echo "Using DNS resolver: $RESOLVER"
envsubst '$PORT $API_INTERNAL_URL $RESOLVER' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
