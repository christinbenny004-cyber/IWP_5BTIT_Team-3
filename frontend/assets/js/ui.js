(function(){
	// Toasts
	const toastContainerId = 'pes-toast-container';
	function ensureToastContainer(){
		let el = document.getElementById(toastContainerId);
		if (!el){
			el = document.createElement('div');
			el.id = toastContainerId;
			el.style.position = 'fixed';
			el.style.top = '16px';
			el.style.right = '16px';
			el.style.zIndex = '1080';
			document.body.appendChild(el);
		}
		return el;
	}
	window.showToast = function(message, type='info'){
		const container = ensureToastContainer();
		const toast = document.createElement('div');
		toast.className = 'pes-toast';
		toast.innerHTML = `<div class="pes-toast-inner ${type}">${message}</div>`;
		container.appendChild(toast);
		setTimeout(()=>{ toast.classList.add('show'); }, 10);
		setTimeout(()=>{ toast.classList.remove('show'); setTimeout(()=> toast.remove(), 300); }, 3000);
	}

	// Confirm modal (returns Promise<boolean>)
	window.confirmModal = function(message){
		return new Promise((resolve)=>{
			const overlay = document.createElement('div');
			overlay.className = 'pes-modal-overlay';
			overlay.innerHTML = `
				<div class="pes-modal">
					<div class="pes-modal-body">${message}</div>
					<div class="pes-modal-actions">
						<button class="btn btn-sm btn-secondary" data-action="cancel">Cancel</button>
						<button class="btn btn-sm btn-primary" data-action="ok">Confirm</button>
					</div>
				</div>`;
			document.body.appendChild(overlay);
			overlay.addEventListener('click', (e)=>{
				if (e.target.dataset.action === 'ok'){ cleanup(); resolve(true); }
				if (e.target.dataset.action === 'cancel' || e.target === overlay){ cleanup(); resolve(false); }
			});
			function cleanup(){ overlay.classList.add('hide'); setTimeout(()=> overlay.remove(), 200); }
		});
	}

	// Theme toggle (light/dark)
	window.initThemeToggle = function(buttonEl){
		const key = 'pes-theme';
		function apply(theme){ document.documentElement.dataset.theme = theme; }
		const saved = localStorage.getItem(key) || 'dark';
		apply(saved);
		if (buttonEl){
			buttonEl.addEventListener('click', ()=>{
				const next = (document.documentElement.dataset.theme === 'dark') ? 'light' : 'dark';
				localStorage.setItem(key, next);
				apply(next);
			});
		}
	}

	// Skeleton helpers
	window.showSkeleton = function(container){ container.classList.add('pes-skeleton'); }
	window.hideSkeleton = function(container){ container.classList.remove('pes-skeleton'); }

	// New: collapsible sidebar toggle
	window.initSidebarToggle = function(toggleBtnId='sidebarToggle'){
		const btn = document.getElementById(toggleBtnId);
		if (!btn) return;
		btn.addEventListener('click', ()=>{
			document.body.classList.toggle('sidebar-collapsed');
		});
	}

	// Table helpers: simple search and sort
	window.attachTableSearch = function(inputEl, tableEl){
		if (!inputEl || !tableEl) return;
		inputEl.addEventListener('input', ()=>{
			const q = inputEl.value.toLowerCase();
			for (const row of tableEl.tBodies[0].rows){
				row.style.display = row.innerText.toLowerCase().includes(q) ? '' : 'none';
			}
		});
	}
	window.attachTableSort = function(tableEl){
		if (!tableEl) return;
		for (const th of tableEl.tHead.rows[0].cells){
			th.style.cursor='pointer';
			th.addEventListener('click', ()=>{
				const idx = th.cellIndex;
				const rows = Array.from(tableEl.tBodies[0].rows);
				const asc = !th.dataset.asc;
				rows.sort((a,b)=> a.cells[idx].innerText.localeCompare(b.cells[idx].innerText));
				if (!asc) rows.reverse();
				th.dataset.asc = asc ? '1':'0';
				for (const r of rows) tableEl.tBodies[0].appendChild(r);
			});
		}
	}

	// Progress updater utility
	window.animateProgressBar = function(barEl, to){
		if (!barEl) return; const from = parseInt(barEl.style.width || '0');
		const target = Math.max(0, Math.min(100, Number(to)));
		const start = performance.now();
		function step(now){
			const t = Math.min(1, (now - start)/500);
			const val = Math.round(from + (target - from)*t);
			barEl.style.width = val + '%';
			if (t < 1) requestAnimationFrame(step);
		}
		requestAnimationFrame(step);
	}
})();
