import { supabase } from "./supabase.js";

const authCard = document.getElementById("auth-card");
const lobbyCard = document.getElementById("lobby-card");
const userName = document.getElementById("user-name");
const msg = document.getElementById("auth-msg");

const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const tabs = document.querySelectorAll(".tab");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const which = tab.dataset.tab;
    loginForm.classList.toggle("active", which === "login");
    signupForm.classList.toggle("active", which === "signup");
    setMsg("");
  });
});

function setMsg(text, kind = "") {
  msg.textContent = text;
  msg.className = "msg" + (kind ? " " + kind : "");
}

function showLobby(session) {
  const name =
    session?.user?.user_metadata?.username ||
    session?.user?.email?.split("@")[0] ||
    "player";
  userName.textContent = name;
  authCard.classList.add("hidden");
  lobbyCard.classList.remove("hidden");
}

function showAuth() {
  authCard.classList.remove("hidden");
  lobbyCard.classList.add("hidden");
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(loginForm);
  setMsg("Signing in…");
  const { error } = await supabase.auth.signInWithPassword({
    email: fd.get("email"),
    password: fd.get("password"),
  });
  if (error) return setMsg(error.message, "error");
  setMsg("");
});

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(signupForm);
  setMsg("Creating account…");
  const { data, error } = await supabase.auth.signUp({
    email: fd.get("email"),
    password: fd.get("password"),
    options: { data: { username: fd.get("username") } },
  });
  if (error) return setMsg(error.message, "error");
  if (data.session) setMsg("");
  else setMsg("Check your email to confirm, then log in.", "ok");
});

document.getElementById("logout-btn").addEventListener("click", async () => {
  await supabase.auth.signOut();
});

supabase.auth.onAuthStateChange((_event, session) => {
  if (session) showLobby(session);
  else showAuth();
});

const { data } = await supabase.auth.getSession();
if (data.session) showLobby(data.session);
