# Deploying to GitHub Pages

This project is configured to deploy to GitHub Pages automatically.

## 🚀 Automatic Deployment (Recommended)

The project uses GitHub Actions to automatically build and deploy when you push to the main branch.

### Setup Steps:

1. **Push your code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/pomp1.git
   git push -u origin main
   ```

2. **Enable GitHub Pages:**
   - Go to your repository on GitHub
   - Click on **Settings** > **Pages**
   - Under "Build and deployment":
     - **Source**: Select "GitHub Actions"
   
3. **Set Environment Variables (Important!):**
   - Go to **Settings** > **Secrets and variables** > **Actions**
   - Click **New repository secret**
   - Add your environment variables:
     - `VITE_PHOTO_LINK` - Your photo server URL
     - `VITE_AUTH_USERNAME` - Login username
     - `VITE_AUTH_PASSWORD` - Login password

4. **Wait for deployment:**
   - The workflow will automatically run
   - Check **Actions** tab to see the deployment progress
   - Once complete, your site will be live at: `https://YOUR_USERNAME.github.io/pomp1/`

### Subsequent Deployments:

Simply push to the main branch:
```bash
git add .
git commit -m "Your changes"
git push
```

The site will automatically rebuild and redeploy!

---

## 📦 Manual Deployment (Alternative)

If you prefer manual deployment using gh-pages:

### One-time Setup:

1. **Install gh-pages:**
   ```bash
   npm install --save-dev gh-pages
   ```

2. **Update vite.config.js** (already configured):
   - The `base` is set to `/pomp1/` for GitHub Pages

3. **Initialize git and add remote:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/pomp1.git
   ```

### Deploy:

Run this command to build and deploy:
```bash
npm run deploy
```

This will:
1. Build your project (`npm run build`)
2. Push the `dist` folder to the `gh-pages` branch
3. GitHub will automatically serve it

### Enable GitHub Pages (Manual Method):

1. Go to repository **Settings** > **Pages**
2. Under "Build and deployment":
   - **Source**: Deploy from a branch
   - **Branch**: Select `gh-pages` and `/ (root)`
3. Click **Save**

Your site will be available at: `https://YOUR_USERNAME.github.io/pomp1/`

---

## 🔐 Environment Variables

**Important:** Environment variables are NOT included in the build by default for security.

For GitHub Actions deployment, add them as repository secrets (see step 3 above).

For manual deployment, they'll use the values from your local `.env` file during build.

**Note:** Since this is client-side authentication, the credentials will be visible in the built JavaScript. For production, consider implementing server-side authentication.

---

## 🔧 Troubleshooting

### Base URL Issues
If your repository name is different from `pomp1`, update `vite.config.js`:
```javascript
base: '/YOUR_REPO_NAME/',
```

### 404 Errors
Make sure the base path matches your repository name.

### Environment Variables Not Working
- For GitHub Actions: Check that secrets are properly set in repository settings
- For manual: Ensure `.env` file exists and has correct values

### Large File Size
The `features.json` file is quite large. If GitHub has issues:
- Consider using Git LFS for large files
- Or host the JSON file separately and fetch from a CDN
