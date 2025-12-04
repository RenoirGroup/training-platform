import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import type { Bindings } from './types';

// Import routes
import auth from './routes/auth';
import admin from './routes/admin';
import consultant from './routes/consultant';
import boss from './routes/boss';
import pathways from './routes/pathways';

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS for API routes
app.use('/api/*', cors());

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }));

// API routes
app.route('/api/auth', auth);
app.route('/api/admin', admin);
app.route('/api/consultant', consultant);
app.route('/api/boss', boss);
app.route('/api', pathways);

// Default route - Login page
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title data-i18n="app.name">The Academy</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link rel="icon" type="image/png" href="/static/ycp-renoir-logo.png">
        <!-- i18next libraries -->
        <script src="https://cdn.jsdelivr.net/npm/i18next@23.7.6/i18next.min.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/i18next-http-backend@2.4.2/i18nextHttpBackend.min.js"></script>
    </head>
    <body class="min-h-screen" style="background: linear-gradient(135deg, #001C44 0%, #1524A9 100%);">
        <!-- Language Selector (Top Right) -->
        <div class="absolute top-4 right-4 z-50">
            <div id="language-selector"></div>
        </div>

        <div class="container mx-auto px-4 py-8">
            <div class="max-w-md mx-auto">
                <div class="text-center mb-8">
                    <img src="/static/ycp-renoir-logo.png" alt="YCP Renoir" class="h-20 mx-auto mb-4" style="filter: invert(1); mix-blend-mode: screen;">
                    <h1 class="text-4xl font-bold mb-2 text-white" data-i18n="app.name">
                        The Academy
                    </h1>
                    <p class="text-blue-200" data-i18n="auth.login.tagline">Excellence in Consulting Training</p>
                </div>

                <div class="bg-white rounded-lg shadow-xl p-8">
                    <h2 class="text-2xl font-bold mb-6" style="color: #001C44;" data-i18n="auth.login.title">Sign In</h2>
                    
                    <div id="error-message" class="hidden bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4"></div>
                    
                    <form id="login-form">
                        <div class="mb-4">
                            <label class="block text-gray-700 text-sm font-bold mb-2" data-i18n="auth.login.email">
                                Email
                            </label>
                            <input 
                                type="email" 
                                id="email" 
                                class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2"
                                style="focus:ring-color: #1524A9;"
                                data-i18n-placeholder="placeholders.enter_email"
                                placeholder="Enter email"
                                required
                            />
                        </div>
                        
                        <div class="mb-6">
                            <label class="block text-gray-700 text-sm font-bold mb-2" data-i18n="auth.login.password">
                                Password
                            </label>
                            <input 
                                type="password" 
                                id="password" 
                                class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:ring-2"
                                style="focus:ring-color: #1524A9;"
                                data-i18n-placeholder="placeholders.enter_password"
                                placeholder="Enter password"
                                required
                            />
                        </div>
                        
                        <button 
                            type="submit" 
                            class="w-full text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors hover:opacity-90"
                            style="background-color: #1524A9;"
                            data-i18n="auth.login.sign_in_button"
                        >
                            Sign In
                        </button>
                    </form>

                    <div class="mt-6 text-sm text-gray-600">
                        <p class="font-bold mb-2" data-i18n="auth.login.demo_accounts">Demo Accounts:</p>
                        <p><strong data-i18n="auth.login.demo_admin">Admin:</strong> admin@training.com / admin123</p>
                        <p><strong data-i18n="auth.login.demo_boss">Boss:</strong> boss@training.com / boss123</p>
                        <p><strong data-i18n="auth.login.demo_consultant">Consultant:</strong> consultant1@training.com / consultant123</p>
                    </div>
                </div>
            </div>
        </div>

        <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
        <script src="/static/i18n-config.js"></script>
        <script>
            // Initialize i18n
            (async function() {
                await initI18n(['common', 'auth']);
                translatePage();
                
                // Create language selector
                createLanguageSelector('language-selector');
            })();

            const form = document.getElementById('login-form');
            const errorDiv = document.getElementById('error-message');

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;

                try {
                    const response = await axios.post('/api/auth/login', { email, password });
                    
                    // Store token and user info
                    localStorage.setItem('token', response.data.token);
                    localStorage.setItem('user', JSON.stringify(response.data.user));
                    
                    // Redirect based on role
                    const role = response.data.user.role;
                    if (role === 'admin') {
                        window.location.href = '/admin';
                    } else if (role === 'boss') {
                        window.location.href = '/boss';
                    } else {
                        window.location.href = '/consultant';
                    }
                } catch (error) {
                    errorDiv.textContent = error.response?.data?.error || i18next.t('auth:errors.login_failed');
                    errorDiv.classList.remove('hidden');
                }
            });
        </script>
    </body>
    </html>
  `);
});

// Admin dashboard
app.get('/admin', (c) => {
  return c.html('<script>window.location.href="/static/admin.html"</script>');
});

// Consultant dashboard
app.get('/consultant', (c) => {
  return c.html('<script>window.location.href="/static/consultant.html"</script>');
});

// Boss dashboard
app.get('/boss', (c) => {
  return c.html('<script>window.location.href="/static/boss.html"</script>');
});

export default app;
