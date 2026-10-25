// MyVideoPlayer admin: sign in, confirm the account is an admin, then hand
// off to the video list (manage.js) and the Add video form (upload.js).
// Security comes from the database's row-level security rules, not this page:
// a non-admin who got past this screen still could not change anything.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../js/supabase-config.js';
import { initUpload } from './upload.js';
import { initManage, loadVideos } from './manage.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const checking = document.getElementById('checking');
const signInPanel = document.getElementById('sign-in');
const signInForm = document.getElementById('sign-in-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const signInError = document.getElementById('sign-in-error');
const signInButton = document.getElementById('sign-in-button');
const dashboard = document.getElementById('dashboard');
const adminEmail = document.getElementById('admin-email');
const signOutButton = document.getElementById('sign-out');

// Which screen is showing: 'checking', 'sign-in' or 'dashboard'
function showScreen(name) {
  checking.hidden = name !== 'checking';
  signInPanel.hidden = name !== 'sign-in';
  dashboard.hidden = name !== 'dashboard';
  signOutButton.hidden = name !== 'dashboard';
}

function showSignIn(message) {
  showScreen('sign-in');
  signInError.textContent = message || '';
  signInError.hidden = !message;
  passwordInput.value = '';
  emailInput.focus();
}

// Signed in: only continue if the database says this user is an admin
async function openDashboard(session) {
  showScreen('checking');
  const { data: isAdmin, error } = await supabase.rpc('is_admin');

  if (error) {
    showSignIn('Could not check your account. Please try again.');
    return;
  }
  if (!isAdmin) {
    await supabase.auth.signOut();
    showSignIn('This account does not have admin access.');
    return;
  }

  adminEmail.textContent = session.user.email;
  showScreen('dashboard');
  loadVideos();
}

// Sign in / sign out

signInForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value;
  if (!email || !password) {
    signInError.textContent = 'Enter your email and password.';
    signInError.hidden = false;
    (email ? passwordInput : emailInput).focus();
    return;
  }

  signInButton.disabled = true;
  signInButton.textContent = 'Signing in…';
  signInError.hidden = true;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  signInButton.disabled = false;
  signInButton.textContent = 'Sign in';

  if (error) {
    const wrongDetails = error.message === 'Invalid login credentials';
    showSignIn(wrongDetails
      ? 'Wrong email or password.'
      : 'Could not sign in. Check your connection and try again.');
    emailInput.value = email;
    passwordInput.focus();
    return;
  }

  openDashboard(data.session);
});

signOutButton.addEventListener('click', async () => {
  await supabase.auth.signOut();
  showSignIn();
});

initManage(supabase);
initUpload({ supabase, onUploaded: loadVideos });

// On load: reuse a remembered session if there is one
const { data: { session } } = await supabase.auth.getSession();
if (session) {
  openDashboard(session);
} else {
  showSignIn();
}
