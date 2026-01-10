const API_BASE =
  window.location.hostname === "localhost"
    ? "http://localhost:8080"
    : "https://ridevise-backend.onrender.com";

    // Typewriter effects (same as before)
    const lines = ["Late already? 🕑", "Don't worry 🤷‍♂️", "We will find the fastest", "and cheapest ride", "for you! 💸"];
    const element = document.getElementById("type-text");
    let lineIndex = 0, charIndex = 0;
    function typeWriter() {
      if (lineIndex >= lines.length) return;
      if (charIndex < lines[lineIndex].length) {
        element.innerHTML += lines[lineIndex].charAt(charIndex);
        charIndex++;
        setTimeout(typeWriter, 40);
      } else {
        element.innerHTML += "<br>";
        charIndex = 0;
        lineIndex++;
        setTimeout(typeWriter, 500);
      }
    }
    typeWriter();

    const lines2 = ["Continue where you left off 😁", "Just login and find", "your best ride 🚗"];
    const el = document.getElementById("typewriter");
    let line = 0, char = 0;
    function typeWriter2() {
      if (line >= lines2.length) return;
      if (char < lines2[line].length) {
        el.innerHTML += lines2[line].charAt(char);
        char++;
        setTimeout(typeWriter2, 60);
      } else {
        el.innerHTML += "<br>";
        char = 0;
        line++;
        setTimeout(typeWriter2, 450);
      }
    }

    // Switch Login/Signup
    const signupCard = document.querySelector(".card");
    const loginContainer = document.querySelector(".container");
    const loginBtn = document.querySelector(".bottom-text span");
    const signupBtn = document.querySelector(".signup-text a");

    function showLogin() {
      signupCard.classList.add("hidden");
      signupCard.classList.remove("visible");
      setTimeout(() => {
        loginContainer.classList.remove("hidden");
        loginContainer.classList.add("visible");
        typeWriter2();
      }, 220);
    }

    function showSignup() {
      loginContainer.classList.add("hidden");
      loginContainer.classList.remove("visible");
      setTimeout(() => {
        signupCard.classList.remove("hidden");
        signupCard.classList.add("visible");
      }, 220);
    }

    signupCard.classList.add("visible");
    loginContainer.classList.add("hidden");

    loginBtn.addEventListener("click", showLogin);
    signupBtn.addEventListener("click", (e) => {
      e.preventDefault();
      showSignup();
    });

    // Password Toggle
    function togglePassword(inputId, clickedIcon) {
      const input = document.getElementById(inputId);
      const field = input.parentElement;
      const lockIcon = field.querySelector('.lock-icon');
      const eyeIcon = field.querySelector('.eye-icon');

      if (input.type === 'password') {
        input.type = 'text';
        lockIcon.classList.remove('active');
        eyeIcon.classList.add('active');
      } else {
        input.type = 'password';
        eyeIcon.classList.remove('active');
        lockIcon.classList.add('active');
      }
    }

    document.querySelector(".login-btn").addEventListener("click", async () => {
  const username = document.querySelector(".left input[type='text']").value;
  const password = document.getElementById("login-password").value;

  if (!username || !password) {
    alert("Fill all fields");
    return;
  }

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  if (res.ok) {
    const data = await res.json();

    // 🔥 IMPORTANT PART
    localStorage.setItem("userId", data.userId);   // Mongo _id
    localStorage.setItem("username", data.username);

    window.location.href = "compare.html"; // compare page
  } else {
    alert("Invalid credentials");
  }
});

    document.querySelector(".panel-white button").addEventListener("click", async () => {
  const username = document.querySelector(".panel-white input[type='text']").value;
  const password = document.getElementById("signup-password").value;

  if (!username || !password) {
    alert("Fill all fields");
    return;
  }

  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  if (res.ok) {
    alert("Signup successful, please login");
  } else {
    alert("Username already exists");
  }
});
