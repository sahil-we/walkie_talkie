document.getElementById("googleLogin").addEventListener("click", () => {
  window.location.href = "https://walkie-talkie-th2x.onrender.com/auth/google";
});

document.getElementById("emailSignup").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const response = await fetch("https://walkie-talkie-th2x.onrender.com/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
  });

  const data = await response.json();
  alert(data.message);
});

document.getElementById("emailLogin").addEventListener("click", async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const response = await fetch("https://walkie-talkie-th2x.onrender.com/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
  });

  const data = await response.json();
  if (data.token) {
      localStorage.setItem("token", data.token);
      alert("Login successful!");
  } else {
      alert(data.error);
  }
});

// ✅ Check for Google Login Token in URL
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get("token");
if (token) {
  localStorage.setItem("token", token);
  alert("Google login successful!");
}
