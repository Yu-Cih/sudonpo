// 漢堡選單切換
const hamburger = document.getElementById('hamburger');
const navLinks = document.querySelector('.nav-links');

if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });

  // 點擊連結後關閉選單
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => navLinks.classList.remove('open'));
  });
}

// 菜單頁籤切換
const tabBtns = document.querySelectorAll('.tab-btn');
const menuContents = document.querySelectorAll('.menu-content');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const targetContent = document.getElementById(btn.dataset.tab);
    if (!targetContent) {
      return;
    }

    tabBtns.forEach(b => b.classList.remove('active'));
    menuContents.forEach(c => c.classList.remove('active'));

    btn.classList.add('active');
    targetContent.classList.add('active');
  });
});

// Navbar 滾動效果
window.addEventListener('scroll', () => {
  const navbarShell = document.getElementById('mainNav') || document.querySelector('header');
  if (!navbarShell) {
    return;
  }

  navbarShell.style.boxShadow = window.scrollY > 10 ? '0 2px 12px rgba(0,0,0,0.3)' : 'none';
});
