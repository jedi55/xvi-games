// ═══════════════════════════════════════
// SPA ROUTER — Hash-based routing
// ═══════════════════════════════════════

class Router {
  constructor() {
    this.routes = [];
    this.currentRoute = null;
    this.beforeHooks = [];
    this.afterHooks = [];
    this.notFoundHandler = null;
    window.addEventListener('hashchange', () => this.resolve());
  }

  // Register a route
  on(path, handler, options = {}) {
    this.routes.push({
      path,
      handler,
      auth: options.auth || false,
      admin: options.admin || false,
      pattern: this._pathToRegex(path)
    });
    return this;
  }

  // Add a before-route hook (for auth checks)
  before(hook) {
    this.beforeHooks.push(hook);
    return this;
  }

  // Add an after-route hook (runs after page render)
  afterEach(hook) {
    this.afterHooks.push(hook);
    return this;
  }

  // Set the catch-all handler
  notFound(handler) {
    this.notFoundHandler = handler;
    return this;
  }

  // Convert path pattern to regex
  _pathToRegex(path) {
    const pattern = path
      .replace(/\//g, '\\/')
      .replace(/:(\w+)/g, '(?<$1>[^/]+)');
    return new RegExp(`^${pattern}$`);
  }

  // Navigate to a route
  navigate(path) {
    window.location.hash = path;
  }

  // Resolve current hash to a route
  async resolve() {
    const hash = window.location.hash.slice(1) || '/';
    
    for (const route of this.routes) {
      const match = hash.match(route.pattern);
      if (match) {
        // Run before hooks
        for (const hook of this.beforeHooks) {
          const result = await hook(route, match.groups || {});
          if (result === false) return;
        }

        this.currentRoute = route;
        const app = document.getElementById('app');
        
        try {
          await route.handler(app, match.groups || {});
          // Run after hooks
          for (const hook of this.afterHooks) {
            hook(route, match.groups || {});
          }
        } catch (err) {
          console.error('Route error:', err);
          app.innerHTML = `
            <div class="page-content" style="display:flex;align-items:center;justify-content:center;min-height:80vh;">
              <div class="empty-state">
                <span class="material-symbols-outlined">error</span>
                <p>Something went wrong</p>
                <button class="btn btn-secondary" onclick="location.hash='/'">Go Home</button>
              </div>
            </div>
          `;
        }
        return;
      }
    }

    // 404 Catch-All
    if (this.notFoundHandler) {
      // Allow Supabase OAuth callback hashes to remain untouched so supabase-js can parse them.
      if (hash.includes('access_token=') || hash.includes('error_description=')) {
        return;
      }
      this.notFoundHandler();
      return;
    }

    const app = document.getElementById('app');
    app.innerHTML = `
      <div class="page-content" style="display:flex;align-items:center;justify-content:center;min-height:80vh;">
        <div class="empty-state">
          <span class="material-symbols-outlined">explore_off</span>
          <p>Page not found</p>
          <button class="btn btn-primary" onclick="location.hash='/'">Go Home</button>
        </div>
      </div>
    `;
  }

  // Start the router
  start() {
    this.resolve();
  }
}

export const router = new Router();
