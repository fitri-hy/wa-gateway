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
const links = Array.from(document.querySelectorAll(".nav-link"));
const currentPath = window.location.pathname;

function normalizePath(path) {
  if (path.length > 1 && path.endsWith("/")) {
    return path.slice(0, -1);
  }
  return path;
}

function isMatch(href, currentPath) {
  href = normalizePath(href);
  currentPath = normalizePath(currentPath);
  return currentPath === href || currentPath.startsWith(href + "/");
}

const normalizedCurrentPath = normalizePath(currentPath);

const matchedLinks = links.filter(link => {
  const href = link.getAttribute("href");
  return isMatch(href, normalizedCurrentPath);
});

let maxLength = -1;
let activeHref = null;

matchedLinks.forEach(link => {
  const href = normalizePath(link.getAttribute("href"));
  if (href.length > maxLength) {
    maxLength = href.length;
    activeHref = href;
  }
});

links.forEach(link => {
  const href = normalizePath(link.getAttribute("href"));
  if (href === activeHref) {
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
