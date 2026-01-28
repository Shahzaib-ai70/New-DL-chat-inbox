#!/bin/bash

echo "==========================================="
echo "🔍 DIAGNOSTIC TOOL FOR DLCHATS.SITE"
echo "==========================================="

echo ""
echo "1️⃣  CHECKING PM2 PROCESS..."
pm2 status dlchats-server
if [ $? -ne 0 ]; then
    echo "❌ App 'dlchats-server' is NOT running!"
else
    echo "✅ App 'dlchats-server' is listed in PM2."
fi

echo ""
echo "2️⃣  CHECKING PORT 3002..."
if lsof -i :3002 > /dev/null; then
    echo "✅ Port 3002 is OPEN and listening."
else
    echo "❌ NOTHING is listening on Port 3002. The app failed to start."
    echo "   -> Checking logs..."
    pm2 logs dlchats-server --lines 10 --nostream
fi

echo ""
echo "3️⃣  CHECKING NGINX STATUS..."
systemctl is-active --quiet nginx
if [ $? -eq 0 ]; then
    echo "✅ Nginx is RUNNING."
else
    echo "❌ Nginx is STOPPED."
fi

echo ""
echo "4️⃣  CHECKING NGINX CONFIG SYNTAX..."
nginx -t

echo ""
echo "5️⃣  CHECKING DOMAIN CONFIG..."
if [ -f /etc/nginx/sites-enabled/dlchats.site ]; then
    echo "✅ /etc/nginx/sites-enabled/dlchats.site EXISTS."
    # Check if content has the correct subdomain
    if grep -q "app.dlchats.site" /etc/nginx/sites-enabled/dlchats.site; then
        echo "✅ Config contains 'app.dlchats.site'."
    else
        echo "⚠️  Config might be missing 'app.dlchats.site'. Please check server_name."
    fi
else
    echo "❌ /etc/nginx/sites-enabled/dlchats.site is MISSING!"
fi

echo ""
echo "==========================================="
echo "If everything has ✅, your site should work."
echo "If Port 3002 has ❌, run: pm2 logs dlchats-server"
echo "==========================================="
