# deploy.ps1
git add .
git commit -m "Автообновление"
git push origin main


npm run build
scp -r dist root@5.129.247.230:/var/www/car-rental-pwa/

cd backend
npm run build
scp -r dist root@5.129.247.230:/var/www/car-rental-pwa/backend/

ssh root@5.129.247.230 "
  pm2 delete autopro-backend 2>/dev/null || true;
  pm2 start /var/www/car-rental-pwa/backend/dist/server.js --name 'autopro-backend';
  sudo systemctl reload nginx;
  echo '✅ Готово!';
"