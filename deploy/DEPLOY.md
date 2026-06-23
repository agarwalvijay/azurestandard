# Deploying the push backend (azurestandard.atsumilabs.com)

Target: Ubuntu VM at `atsumilabs.com` (user `vagarwal`), served behind nginx + Let's Encrypt at
`https://azurestandard.atsumilabs.com`, proxying to the Node backend on `127.0.0.1:8080`.

## 1. Code
```bash
cd ~
git clone https://github.com/agarwalvijay/azurestandard.git azurestandard
cd azurestandard/backend
npm ci --omit=dev
```

## 2. Secrets (NOT in git — copy from your Mac)
```bash
# from the Mac:
scp backend/service-account.json vagarwal@atsumilabs.com:~/azurestandard/backend/
scp backend/.env                 vagarwal@atsumilabs.com:~/azurestandard/backend/
```
`.env` must contain `PORT=8080`, a strong `ADMIN_KEY`, and
`GOOGLE_APPLICATION_CREDENTIALS=./service-account.json`.

## 3. Run under pm2
```bash
sudo npm install -g pm2
cd ~/azurestandard
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup systemd -u vagarwal --hp /home/vagarwal   # prints a sudo command — run it
curl -s localhost:8080/health   # -> {"ok":true}
```

## 4. nginx + TLS
```bash
sudo cp deploy/nginx-azurestandard.conf /etc/nginx/sites-available/azurestandard
sudo ln -sf /etc/nginx/sites-available/azurestandard /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d azurestandard.atsumilabs.com --non-interactive --agree-tos -m vijay@aoknos.com --redirect
```

## 5. Point the app at it
In `app/www/app.js` set `CONFIG.BACKEND_URL = "https://azurestandard.atsumilabs.com"`,
then `npx cap sync android && (cd android && ./gradlew assembleRelease)` and reinstall.

## Update / redeploy
```bash
cd ~/azurestandard && git pull && cd backend && npm ci --omit=dev && pm2 restart azurestandard
```
