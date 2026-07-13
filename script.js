// Configurações principais do projeto.
const STORAGE_KEYS = {
  visitorName: 'cha-casa-nova-visitor-name',
  reserved: 'cha-casa-nova-reserved',
  gifts: 'cha-casa-nova-gifts',
  theme: 'cha-casa-nova-theme'
};

const TELEGRAM_BOT_TOKEN = '8926548827:AAFE2f-deqgs2PslCZ-Z7NUgK2VQUkWLDqk';
const TELEGRAM_CHAT_ID = '957453226';

const appState = {
  gifts: [],
  reservedIds: new Set(),
  search: '',
  category: 'todos'
};

let editingGiftId = null;

// Inicialização principal da aplicação.
document.addEventListener('DOMContentLoaded', () => {
  setupTheme();
  setupScrollTop();

  if (document.body.dataset.page === 'admin') {
    initAdminPage();
  } else {
    initHomePage();
  }
});

// Página inicial.
async function initHomePage() {
  showLoader();

  try {
    await loadGifts();
    const savedReserved = JSON.parse(localStorage.getItem(STORAGE_KEYS.reserved) || '[]');
    appState.reservedIds = new Set(savedReserved);
    appState.gifts = appState.gifts.map((item) => ({
      ...item,
      reservado: appState.reservedIds.has(item.id)
    }));
  } catch (error) {
    console.warn('Não foi possível carregar os presentes:', error);
    appState.gifts = [];
    showToast(error.message || 'Não foi possível carregar a lista de presentes.');
  } finally {
    bindHomeEvents();
    renderHome();

    const savedName = getStoredVisitorName();
    if (savedName) {
      closeNameModal();
      showWelcome(savedName);
    } else {
      openNameModal();
    }

    hideLoader();
  }
}

function bindHomeEvents() {
  const searchInput = document.getElementById('searchInput');
  const categoryFilter = document.getElementById('categoryFilter');
  const nameForm = document.getElementById('nameForm');

  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      appState.search = event.target.value.toLowerCase();
      renderHome();
    });
  }

  if (categoryFilter) {
    categoryFilter.addEventListener('change', (event) => {
      appState.category = event.target.value;
      renderHome();
    });
  }

  if (nameForm) {
    nameForm.addEventListener('submit', handleNameSubmit);
  }
}

function renderHome() {
  const grid = document.getElementById('giftGrid');
  const reservedGrid = document.getElementById('reservedGrid');
  const availableCount = document.getElementById('availableCount');
  const reservedCount = document.getElementById('reservedCount');

  if (!grid || !reservedGrid || !availableCount || !reservedCount) {
    return;
  }

  const availableItems = appState.gifts.filter((item) => !item.reservado && matchesFilters(item));
  const reservedItems = appState.gifts.filter((item) => item.reservado && matchesFilters(item));

  grid.innerHTML = '';
  reservedGrid.innerHTML = '';

  if (availableItems.length === 0) {
    grid.innerHTML = '<p class="empty-state">Nenhum presente disponível com esse filtro.</p>';
  } else {
    availableItems.forEach((item) => {
      grid.appendChild(createGiftCard(item));
    });
  }

  if (reservedItems.length === 0) {
    reservedGrid.innerHTML = '<p class="empty-state">Ainda não há presentes reservados.</p>';
  } else {
    reservedItems.forEach((item) => {
      reservedGrid.appendChild(createReservedCard(item));
    });
  }

  availableCount.textContent = availableItems.length;
  reservedCount.textContent = reservedItems.length;
}

function matchesFilters(item) {
  const matchesSearch = !appState.search || item.nome.toLowerCase().includes(appState.search);
  const matchesCategory = appState.category === 'todos' || item.categoria === appState.category;
  return matchesSearch && matchesCategory;
}

function createGiftCard(item) {
  const card = document.createElement('article');
  card.className = 'gift-card';

  card.innerHTML = `
    <img src="${item.imagem}" alt="${item.nome}" />
    <div class="gift-info">
      <h3>${item.nome}</h3>
      <p class="gift-meta">${item.descricao}</p>
      <p class="gift-price">${item.valor || 'Consulte o valor'}</p>
      <div class="gift-actions">
        <button type="button">Comprar Presente</button>
      </div>
    </div>
  `;

  card.querySelector('button').addEventListener('click', () => initiatePurchase(item));
  return card;
}

function createReservedCard(item) {
  const card = document.createElement('article');
  card.className = 'gift-card reserved-card';

  card.innerHTML = `
    <img src="${item.imagem}" alt="${item.nome}" />
    <div class="gift-info">
      <h3>${item.nome}</h3>
      <p class="gift-meta">${item.descricao}</p>
      <p class="gift-price">${item.valor || 'Consulte o valor'}</p>
      <div class="gift-actions">
        <span class="reserve-badge">✅ Presente reservado</span>
      </div>
    </div>
  `;

  return card;
}

async function initiatePurchase(item) {
  // Abre o link primeiro
  window.open(item.link, '_blank', 'noopener');

  // Aguarda um pouco e depois exibe o pop-up de confirmação
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const confirmed = window.confirm('Você confirma que irá comprar este presente?');
  if (!confirmed) {
    return;
  }

  try {
    await sendTelegramNotification(item);

    item.reservado = true;
    appState.reservedIds.add(item.id);
    persistGifts();
    renderHome();
    showToast('Presente reservado com sucesso!');
  } catch (error) {
    showToast(error.message || 'Houve um problema ao reservar o presente.');
  }
}

async function sendTelegramNotification(item) {
  const visitorName = localStorage.getItem(STORAGE_KEYS.visitorName) || 'Visitante';
  const time = new Date().toLocaleString('pt-BR');

  if (TELEGRAM_BOT_TOKEN.includes('SEU') || TELEGRAM_CHAT_ID.includes('SEU')) {
    throw new Error('Configure o BOT TOKEN e o CHAT ID do Telegram para habilitar o envio da mensagem.');
  }

  const message = `Novo presente reservado!\n\nNome: ${visitorName}\nItem: ${item.nome}\nHorário: ${time}\nLink: ${item.link}`;

  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message
    })
  });

  if (!response.ok) {
    throw new Error('Falha ao enviar a mensagem para o Telegram.');
  }
}

function getStoredVisitorName() {
  return localStorage.getItem(STORAGE_KEYS.visitorName)?.trim() || '';
}

function saveVisitorName(name) {
  localStorage.setItem(STORAGE_KEYS.visitorName, name.trim());
}

function handleNameSubmit(event) {
  event.preventDefault();
  const input = document.getElementById('visitorName');
  const name = input.value.trim();

  if (!name) {
    showToast('Informe seu nome para continuar.');
    return;
  }

  saveVisitorName(name);
  closeNameModal();
  showWelcome(name);
}

function openNameModal() {
  const modal = document.getElementById('nameModal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

function closeNameModal() {
  const modal = document.getElementById('nameModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

function showWelcome(name) {
  const hero = document.querySelector('.hero-copy');
  if (!hero) {
    return;
  }

  const existing = hero.querySelector('.welcome-message');
  if (existing) {
    existing.remove();
  }

  const welcome = document.createElement('p');
  welcome.className = 'welcome-message';
  welcome.textContent = `Olá, ${name}! Que bom que você está aqui.`;
  hero.insertBefore(welcome, hero.querySelector('.cta'));
}

function persistGifts() {
  localStorage.setItem(STORAGE_KEYS.gifts, JSON.stringify(appState.gifts));
  localStorage.setItem(STORAGE_KEYS.reserved, JSON.stringify([...appState.reservedIds]));
}

async function loadGifts() {
  const storedItems = localStorage.getItem(STORAGE_KEYS.gifts);
  if (storedItems) {
    appState.gifts = JSON.parse(storedItems);
    return;
  }

  const response = await fetch('./presentes.json');
  if (!response.ok) {
    throw new Error('Não foi possível carregar os presentes.');
  }

  appState.gifts = await response.json();
  localStorage.setItem(STORAGE_KEYS.gifts, JSON.stringify(appState.gifts));
}

function setupTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.theme) || 'light';
  const toggle = document.getElementById('themeToggle');

  document.body.classList.toggle('dark', savedTheme === 'dark');
  if (toggle) {
    toggle.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
    toggle.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark');
      localStorage.setItem(STORAGE_KEYS.theme, isDark ? 'dark' : 'light');
      toggle.textContent = isDark ? '🌙' : '☀️';
    });
  }
}

function setupScrollTop() {
  const button = document.getElementById('scrollTop');
  if (!button) {
    return;
  }

  window.addEventListener('scroll', () => {
    button.classList.toggle('visible', window.scrollY > 450);
  });

  button.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function showLoader() {
  const loader = document.getElementById('loader');
  if (loader) {
    loader.classList.remove('hidden');
  }
}

function hideLoader() {
  const loader = document.getElementById('loader');
  if (loader) {
    loader.classList.add('hidden');
  }
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timeoutId);
  showToast.timeoutId = setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

// Painel administrativo.
async function initAdminPage() {
  showLoader();

  const auth = sessionStorage.getItem('cha-admin-auth');
  if (!auth) {
    const password = prompt('Digite a senha de administração');
    if (password !== '100203') {
      alert('Senha incorreta.');
      window.location.href = 'index.html';
      return;
    }
    sessionStorage.setItem('cha-admin-auth', 'true');
  }

  try {
    await loadGifts();
    bindAdminEvents();
    renderAdminList();
  } catch (error) {
    showToast(error.message || 'Não foi possível carregar o painel.');
  } finally {
    hideLoader();
  }
}

function bindAdminEvents() {
  const form = document.getElementById('giftForm');
  const cancelButton = document.getElementById('cancelEdit');

  if (form) {
    form.addEventListener('submit', handleAdminSubmit);
  }

  if (cancelButton) {
    cancelButton.addEventListener('click', resetAdminForm);
  }
}

function handleAdminSubmit(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const data = new FormData(form);
  const gift = {
    id: Number(document.getElementById('giftId').value) || Date.now(),
    nome: data.get('nome'),
    descricao: data.get('descricao'),
    categoria: data.get('categoria'),
    valor: data.get('valor'),
    imagem: data.get('imagem'),
    link: data.get('link'),
    comprado: false
  };

  if (editingGiftId) {
    appState.gifts = appState.gifts.map((item) => (item.id === editingGiftId ? { ...item, ...gift } : item));
  } else {
    appState.gifts.push(gift);
  }

  persistGifts();
  renderAdminList();
  resetAdminForm();
  showToast('Presente salvo com sucesso.');
}

function renderAdminList() {
  const list = document.getElementById('adminList');
  if (!list) {
    return;
  }

  list.innerHTML = '';

  appState.gifts.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'admin-item';

    row.innerHTML = `
      <div>
        <strong>${item.nome}</strong>
        <p>${item.descricao}</p>
      </div>
      <div class="admin-item-actions">
        <button type="button" class="secondary" data-action="edit">Editar</button>
        <button type="button" class="secondary" data-action="toggle">${item.reservado ? 'Desmarcar' : 'Reservar'}</button>
        <button type="button" class="secondary" data-action="delete">Remover</button>
      </div>
    `;

    row.querySelector('[data-action="edit"]').addEventListener('click', () => loadGiftToForm(item));
    row.querySelector('[data-action="toggle"]').addEventListener('click', () => toggleGiftStatus(item));
    row.querySelector('[data-action="delete"]').addEventListener('click', () => deleteGift(item.id));

    list.appendChild(row);
  });
}

function loadGiftToForm(item) {
  editingGiftId = item.id;
  document.getElementById('giftId').value = item.id;
  document.getElementById('giftName').value = item.nome;
  document.getElementById('giftDescription').value = item.descricao;
  document.getElementById('giftCategory').value = item.categoria || '';
  document.getElementById('giftValue').value = item.valor || '';
  document.getElementById('giftImage').value = item.imagem || '';
  document.getElementById('giftLink').value = item.link || '';
  document.getElementById('giftName').focus();
}

function resetAdminForm() {
  editingGiftId = null;
  document.getElementById('giftForm').reset();
  document.getElementById('giftId').value = '';
}

function toggleGiftStatus(item) {
  item.reservado = !item.reservado;
  if (item.reservado) {
    item.comprado = true;
  }
  persistGifts();
  renderAdminList();
  showToast(item.reservado ? 'Presente marcado como reservado.' : 'Reserva removida.');
}

function deleteGift(id) {
  const shouldDelete = window.confirm('Deseja remover este presente da lista?');
  if (!shouldDelete) {
    return;
  }

  appState.gifts = appState.gifts.filter((item) => item.id !== id);
  persistGifts();
  renderAdminList();
  showToast('Presente removido.');
}
