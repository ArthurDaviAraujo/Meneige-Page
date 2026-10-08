const form = document.getElementById('loginForm');
const user = document.getElementById('user');
const pass = document.getElementById('pass');
const toggle = document.querySelector('.toggle');
const btn = document.getElementById('submitBtn');
const error = document.getElementById('error');
const themeToggle = document.getElementById('themeToggle');
document.getElementById('year').textContent = new Date().getFullYear();

function syncThemeToggle() {
  if (!themeToggle) return;
  const isDark = document.documentElement.dataset.theme === 'dark';
  themeToggle.setAttribute('aria-pressed', String(isDark));
  themeToggle.setAttribute('aria-label', isDark ? 'Ativar tema claro' : 'Ativar tema escuro');
  themeToggle.querySelector('i').className = isDark ? 'ri-sun-line' : 'ri-moon-clear-line';
  themeToggle.querySelector('span').textContent = isDark ? 'Tema claro' : 'Tema escuro';
}

themeToggle?.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('systemcollege-theme', next);
  syncThemeToggle();
});

syncThemeToggle();

toggle.addEventListener('click', () => {
  const isPwd = pass.getAttribute('type') === 'password';
  pass.setAttribute('type', isPwd ? 'text' : 'password');
  toggle.firstElementChild.className = isPwd ? 'ri-eye-line' : 'ri-eye-off-line';
  pass.focus();
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  error.hidden = true;
  btn.disabled = true;

  try {
    const res = await fetch('api/auth/login.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ user: user.value.trim(), pass: pass.value })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data?.message || 'Falha no login');
    }

    // OK: vai para o dashboard
    window.location.href = 'dashboard/dashboard.html';
  } catch (err) {
    error.textContent = err.message || 'Usuário ou senha inválidos.';
    error.hidden = false;
    form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
    btn.disabled = false;
  }
});
