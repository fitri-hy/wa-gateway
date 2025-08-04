// Sidebar
const sidebar = document.getElementById("sidebar");
const closeBtn = document.getElementById("closeSidebarBtn");

if (sidebar && closeBtn) {
  function toggleSidebar() {
    const isOpen = sidebar.classList.contains("translate-x-0");

    if (isOpen) {
      sidebar.classList.remove("translate-x-0");
      sidebar.classList.add("-translate-x-full");
      document.removeEventListener("click", handleClickOutside);
    } else {
      sidebar.classList.add("translate-x-0");
      sidebar.classList.remove("-translate-x-full");
      setTimeout(() => {
        document.addEventListener("click", handleClickOutside);
      }, 0);
    }
  }

  function handleClickOutside(event) {
    if (!sidebar.contains(event.target)) {
      toggleSidebar();
    }
  }

  closeBtn.addEventListener("click", toggleSidebar);
}

// Nav Link
const links = document.querySelectorAll(".nav-link");
const currentPath = window.location.pathname;

links.forEach(link => {
  if (link.getAttribute("href") === currentPath) {
    link.classList.add("text-sky-500", "font-semibold");
  } else {
    link.classList.remove("text-sky-500", "font-semibold");
  }
});

// Dark Mode
const toggleBtn = document.getElementById("toggleDark");
const htmlEl = document.documentElement;
const iconSun = document.getElementById("iconSun");
const iconMoon = document.getElementById("iconMoon");

function updateIcon() {
  if (!iconSun || !iconMoon) return;

  if (htmlEl.classList.contains("dark")) {
    iconSun.classList.add("hidden");
    iconMoon.classList.remove("hidden");
  } else {
    iconSun.classList.remove("hidden");
    iconMoon.classList.add("hidden");
  }
}

if (localStorage.getItem("darkMode") === "true") {
  htmlEl.classList.add("dark");
}
updateIcon();

if (toggleBtn) {
  toggleBtn.addEventListener("click", () => {
    htmlEl.classList.toggle("dark");
    localStorage.setItem("darkMode", htmlEl.classList.contains("dark"));
    updateIcon();
  });
}
