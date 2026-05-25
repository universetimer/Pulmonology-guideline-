// Sidebar TOC + search + active section tracking
(function () {
  const docPage = document.body.dataset.page; // 'manual' | 'summary'
  if (!docPage) return;

  const sidebar = document.querySelector('aside.sidebar ul.toc-list');
  const searchInput = document.querySelector('aside.sidebar input[type="search"]');
  const tocLinks = [];

  fetch('assets/toc.json')
    .then(r => r.json())
    .then(data => {
      const entries = data[docPage] || [];
      entries.forEach(item => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#' + item.slug;
        a.textContent = item.text;
        a.className = 'toc-link level-' + item.level;
        a.dataset.text = item.text.toLowerCase();
        li.appendChild(a);
        sidebar.appendChild(li);
        tocLinks.push(a);
      });
      setupScrollSpy();
    })
    .catch(err => {
      console.error('TOC load failed', err);
      sidebar.innerHTML = '<li style="padding:8px;color:#999">목차 로드 실패</li>';
    });

  // Search filter
  if (searchInput) {
    searchInput.addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();
      tocLinks.forEach(a => {
        if (!q || a.dataset.text.includes(q)) a.classList.remove('hidden');
        else a.classList.add('hidden');
      });
    });
  }

  // Active section tracking on scroll
  function setupScrollSpy() {
    const headings = Array.from(document.querySelectorAll('main.content h1[id], main.content h2[id], main.content h3[id]'));
    if (!headings.length) return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          tocLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + id));
        }
      });
    }, { rootMargin: '-80px 0px -70% 0px', threshold: 0 });
    headings.forEach(h => observer.observe(h));
  }

  // Mobile sidebar toggle
  const toggleBtn = document.querySelector('.menu-toggle');
  const sidebarEl = document.querySelector('aside.sidebar');
  const backdrop = document.querySelector('.sidebar-backdrop');
  function closeSidebar() {
    sidebarEl?.classList.remove('open');
    backdrop?.classList.remove('open');
  }
  toggleBtn?.addEventListener('click', () => {
    sidebarEl?.classList.toggle('open');
    backdrop?.classList.toggle('open');
  });
  backdrop?.addEventListener('click', closeSidebar);
  sidebarEl?.addEventListener('click', e => {
    if (e.target.classList.contains('toc-link') && window.innerWidth <= 900) {
      closeSidebar();
    }
  });
})();
