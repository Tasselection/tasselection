/**
 * BRIEF CLIENT - Future Ready
 * Wizard navigation, form handling, storage, and export
 */

(function() {
    'use strict';

    // ===========================================
    // CONFIGURATION
    // ===========================================

    const STORAGE_KEY = 'client_brief_draft';
    const AUTO_SAVE_DELAY = 1000;
    const TOTAL_STEPS = 12;

    const SECTIONS = [
        { id: 1, name: 'Informations Générales' },
        { id: 2, name: 'Contact Client' },
        { id: 3, name: 'Informations Projet' },
        { id: 4, name: 'Cible & Participants' },
        { id: 5, name: 'Contexte' },
        { id: 6, name: 'Programme Prévisionnel' },
        { id: 7, name: 'Concept & Expérience' },
        { id: 8, name: 'Format & Contenu' },
        { id: 9, name: 'Logistique & Technique' },
        { id: 10, name: 'Identité Visuelle' },
        { id: 11, name: 'Budget' },
        { id: 12, name: 'Contraintes & Opportunités' }
    ];

    // ===========================================
    // STATE
    // ===========================================

    let currentStep = 1;
    let formData = {};
    let autoSaveTimeout = null;

    // ===========================================
    // DOM ELEMENTS
    // ===========================================

    const elements = {
        wizardSteps: () => document.querySelectorAll('.wizard-step'),
        navItems: () => document.querySelectorAll('.nav-item'),
        prevBtn: () => document.getElementById('prevBtn'),
        nextBtn: () => document.getElementById('nextBtn'),
        reviewBtn: () => document.getElementById('reviewBtn'),
        modal: () => document.querySelector('.modal-overlay'),
        modalBody: () => document.querySelector('.modal-body'),
        saveIndicator: () => document.querySelector('.save-indicator'),
        toastContainer: () => document.querySelector('.toast-container'),
        form: () => document.getElementById('briefForm'),
        sidebar: () => document.getElementById('sidebar'),
        menuToggle: () => document.getElementById('menuToggle')
    };

    // ===========================================
    // INITIALIZATION
    // ===========================================

    function init() {
        loadDraft();
        setupEventListeners();
        updateUI();
        setupAutoSave();
    }

    function setupEventListeners() {
        // Navigation buttons
        elements.prevBtn()?.addEventListener('click', goToPrevStep);
        elements.nextBtn()?.addEventListener('click', goToNextStep);
        elements.reviewBtn()?.addEventListener('click', openReviewModal);

        // Sidebar navigation - click any section anytime
        elements.navItems().forEach(item => {
            item.addEventListener('click', () => {
                const step = parseInt(item.dataset.step);
                goToStep(step);
                // Close mobile menu
                elements.sidebar()?.classList.remove('open');
            });
        });

        // Mobile menu toggle
        elements.menuToggle()?.addEventListener('click', () => {
            elements.sidebar()?.classList.toggle('open');
        });

        // Modal close
        document.querySelector('.modal-close')?.addEventListener('click', closeModal);
        elements.modal()?.addEventListener('click', (e) => {
            if (e.target === elements.modal()) closeModal();
        });

        // Export buttons
        document.getElementById('exportPdf')?.addEventListener('click', exportToPDF);
        document.getElementById('exportClipboard')?.addEventListener('click', exportToClipboard);
        document.getElementById('newBrief')?.addEventListener('click', resetForm);

        // Timeline add buttons
        document.querySelectorAll('.btn-add-timeline').forEach(btn => {
            btn.addEventListener('click', () => addTimelineItem(btn));
        });

        // Keyboard navigation
        document.addEventListener('keydown', handleKeyNavigation);

        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
            const sidebar = elements.sidebar();
            const menuToggle = elements.menuToggle();
            if (sidebar && menuToggle &&
                !sidebar.contains(e.target) &&
                !menuToggle.contains(e.target) &&
                sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
            }
        });
    }

    function setupAutoSave() {
        const form = elements.form();
        if (!form) return;

        form.addEventListener('input', debounce(() => {
            collectFormData();
            saveDraft();
        }, AUTO_SAVE_DELAY));

        form.addEventListener('change', () => {
            collectFormData();
            saveDraft();
        });
    }

    // ===========================================
    // NAVIGATION
    // ===========================================

    function goToStep(step) {
        if (step < 1 || step > TOTAL_STEPS) return;

        collectFormData();
        currentStep = step;
        updateUI();

        // Scroll to top of main content
        document.querySelector('.main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function goToPrevStep() {
        goToStep(currentStep - 1);
    }

    function goToNextStep() {
        goToStep(currentStep + 1);
    }

    function handleKeyNavigation(e) {
        if (e.target.tagName === 'TEXTAREA') return;

        if (e.key === 'ArrowRight' && e.altKey) {
            e.preventDefault();
            goToNextStep();
        } else if (e.key === 'ArrowLeft' && e.altKey) {
            e.preventDefault();
            goToPrevStep();
        }
    }

    function updateUI() {
        // Update step visibility
        elements.wizardSteps().forEach((step, index) => {
            step.classList.toggle('active', index + 1 === currentStep);
        });

        // Update sidebar navigation
        elements.navItems().forEach((item, index) => {
            item.classList.remove('active');
            if (index + 1 === currentStep) {
                item.classList.add('active');
            }
            // Mark completed sections (has any data)
            const sectionData = getSectionData(index + 1);
            if (sectionData && Object.values(sectionData).some(v => v && v.toString().trim())) {
                item.classList.add('completed');
            } else {
                item.classList.remove('completed');
            }
        });

        // Update navigation buttons
        const prevBtn = elements.prevBtn();
        const nextBtn = elements.nextBtn();
        const reviewBtn = elements.reviewBtn();

        if (prevBtn) prevBtn.style.visibility = currentStep === 1 ? 'hidden' : 'visible';

        if (nextBtn && reviewBtn) {
            if (currentStep === TOTAL_STEPS) {
                nextBtn.style.display = 'none';
                reviewBtn.style.display = 'inline-flex';
            } else {
                nextBtn.style.display = 'inline-flex';
                reviewBtn.style.display = 'none';
            }
        }
    }

    function getSectionData(sectionId) {
        const fields = getSectionFields(sectionId);
        const data = {};
        fields.forEach(f => {
            if (formData[f.name]) {
                data[f.name] = formData[f.name];
            }
        });
        return data;
    }

    // ===========================================
    // FORM DATA MANAGEMENT
    // ===========================================

    function collectFormData() {
        const form = elements.form();
        if (!form) return;

        const inputs = form.querySelectorAll('input, textarea, select');

        inputs.forEach(input => {
            const name = input.name;
            if (!name) return;

            if (input.type === 'checkbox') {
                if (!formData[name]) formData[name] = [];
                if (input.checked) {
                    if (!formData[name].includes(input.value)) {
                        formData[name].push(input.value);
                    }
                } else {
                    formData[name] = formData[name].filter(v => v !== input.value);
                }
            } else if (input.type === 'radio') {
                if (input.checked) {
                    formData[name] = input.value;
                }
            } else {
                formData[name] = input.value;
            }
        });

        // Collect timeline data
        collectTimelineData();
    }

    function collectTimelineData() {
        const timelineItems = document.querySelectorAll('.timeline-item');
        const timeline = [];

        timelineItems.forEach(item => {
            const time = item.querySelector('.timeline-time input')?.value;
            const desc = item.querySelector('.timeline-description input')?.value;
            if (time || desc) {
                timeline.push({ time, description: desc });
            }
        });

        formData.programme_timeline = timeline;
    }

    function populateForm() {
        const form = elements.form();
        if (!form || !formData) return;

        Object.keys(formData).forEach(key => {
            if (key === 'programme_timeline') {
                populateTimeline(formData[key]);
                return;
            }

            const input = form.querySelector(`[name="${key}"]`);
            if (!input) return;

            if (input.type === 'checkbox') {
                const values = formData[key] || [];
                const checkboxes = form.querySelectorAll(`[name="${key}"]`);
                checkboxes.forEach(cb => {
                    cb.checked = values.includes(cb.value);
                });
            } else if (input.type === 'radio') {
                const radios = form.querySelectorAll(`[name="${key}"]`);
                radios.forEach(radio => {
                    radio.checked = radio.value === formData[key];
                });
            } else {
                input.value = formData[key] || '';
            }
        });
    }

    function populateTimeline(timeline) {
        if (!timeline || !Array.isArray(timeline)) return;

        const container = document.querySelector('.timeline-builder');
        if (!container) return;

        // Clear existing items except template
        const existingItems = container.querySelectorAll('.timeline-item');
        existingItems.forEach((item, index) => {
            if (index > 0) item.remove();
        });

        // Populate first item or add new items
        timeline.forEach((item, index) => {
            if (index === 0) {
                const firstItem = container.querySelector('.timeline-item');
                if (firstItem) {
                    firstItem.querySelector('.timeline-time input').value = item.time || '';
                    firstItem.querySelector('.timeline-description input').value = item.description || '';
                }
            } else {
                addTimelineItem(container.querySelector('.btn-add-timeline'), item);
            }
        });
    }

    // ===========================================
    // STORAGE
    // ===========================================

    function saveDraft() {
        showSaveIndicator('saving');

        const payload = {
            data: formData,
            currentStep: currentStep,
            lastSaved: new Date().toISOString(),
            version: '1.0'
        };

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
            setTimeout(() => showSaveIndicator('saved'), 300);
        } catch (e) {
            console.error('Failed to save draft:', e);
            showToast('Erreur lors de la sauvegarde', 'error');
        }
    }

    function loadDraft() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored) return;

            const payload = JSON.parse(stored);
            formData = payload.data || {};
            currentStep = payload.currentStep || 1;

            populateForm();

            const lastSaved = new Date(payload.lastSaved);
            showToast(`Brouillon restauré (${formatDate(lastSaved)})`, 'success');
        } catch (e) {
            console.error('Failed to load draft:', e);
        }
    }

    function resetForm() {
        if (!confirm('Êtes-vous sûr de vouloir créer un nouveau brief ? Les données actuelles seront perdues.')) {
            return;
        }

        localStorage.removeItem(STORAGE_KEY);
        formData = {};
        currentStep = 1;

        const form = elements.form();
        if (form) form.reset();

        // Reset timeline
        const timelineContainer = document.querySelector('.timeline-builder');
        if (timelineContainer) {
            const items = timelineContainer.querySelectorAll('.timeline-item');
            items.forEach((item, index) => {
                if (index > 0) item.remove();
                else {
                    item.querySelector('.timeline-time input').value = '';
                    item.querySelector('.timeline-description input').value = '';
                }
            });
        }

        updateUI();
        closeModal();
        showToast('Nouveau brief créé', 'success');
    }

    function showSaveIndicator(status) {
        const indicator = elements.saveIndicator();
        if (!indicator) return;

        indicator.classList.remove('saving', 'saved');
        indicator.classList.add('visible', status);

        if (status === 'saving') {
            indicator.textContent = 'Sauvegarde...';
        } else {
            indicator.textContent = 'Sauvegardé';
            setTimeout(() => {
                indicator.classList.remove('visible');
            }, 2000);
        }
    }

    // ===========================================
    // TIMELINE
    // ===========================================

    function addTimelineItem(btn, data = null) {
        const container = btn?.closest('.timeline-builder') || document.querySelector('.timeline-builder');
        if (!container) return;

        const template = container.querySelector('.timeline-item');
        if (!template) return;

        const newItem = template.cloneNode(true);
        newItem.querySelector('.timeline-time input').value = data?.time || '';
        newItem.querySelector('.timeline-description input').value = data?.description || '';

        // Add remove button
        let removeBtn = newItem.querySelector('.timeline-remove');
        if (!removeBtn) {
            removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.className = 'timeline-remove';
            removeBtn.innerHTML = '×';
            newItem.appendChild(removeBtn);
        }

        removeBtn.addEventListener('click', () => {
            newItem.remove();
            collectFormData();
            saveDraft();
        });

        container.insertBefore(newItem, btn);
    }

    // ===========================================
    // REVIEW MODAL
    // ===========================================

    function openReviewModal() {
        collectFormData();
        generateReviewContent();
        elements.modal()?.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        elements.modal()?.classList.remove('active');
        document.body.style.overflow = '';
    }

    function generateReviewContent() {
        const modalBody = elements.modalBody();
        if (!modalBody) return;

        let html = '';

        SECTIONS.forEach(section => {
            html += `
                <div class="review-section">
                    <h3 class="review-section-title">${String(section.id).padStart(2, '0')} — ${section.name}</h3>
                    ${generateSectionReview(section.id)}
                </div>
            `;
        });

        modalBody.innerHTML = html;
    }

    function generateSectionReview(sectionId) {
        const fields = getSectionFields(sectionId);
        let html = '';

        fields.forEach(field => {
            const value = getFieldValue(field.name);
            html += `
                <div class="review-field">
                    <span class="review-label">${field.label}</span>
                    <span class="review-value">${formatReviewValue(value, field.type)}</span>
                </div>
            `;
        });

        return html;
    }

    function getSectionFields(sectionId) {
        const fieldMappings = {
            1: [
                { name: 'entreprise', label: 'Entreprise', type: 'text' },
                { name: 'secteur', label: 'Secteur d\'activité', type: 'text' },
                { name: 'ville', label: 'Ville', type: 'text' },
                { name: 'notes_1', label: 'Notes', type: 'textarea' }
            ],
            2: [
                { name: 'contact_nom', label: 'Nom & Prénom', type: 'text' },
                { name: 'contact_telephone', label: 'Téléphone', type: 'text' },
                { name: 'contact_email', label: 'Email', type: 'text' },
                { name: 'notes_2', label: 'Notes', type: 'textarea' }
            ],
            3: [
                { name: 'evenement_nom', label: 'Nom de l\'événement', type: 'text' },
                { name: 'evenement_dates', label: 'Date(s) envisagée(s)', type: 'text' },
                { name: 'evenement_lieu', label: 'Lieu / Zone géographique', type: 'text' },
                { name: 'evenement_format', label: 'Format', type: 'text' },
                { name: 'notes_3', label: 'Notes', type: 'textarea' }
            ],
            4: [
                { name: 'participants_nombre', label: 'Nombre de participants', type: 'text' },
                { name: 'participants_public', label: 'Public invité', type: 'text' },
                { name: 'participants_fonction', label: 'Fonction', type: 'text' },
                { name: 'participants_age', label: 'Âge moyen', type: 'text' },
                { name: 'participants_provenance', label: 'Provenance géographique', type: 'text' },
                { name: 'notes_4', label: 'Notes', type: 'textarea' }
            ],
            5: [
                { name: 'contexte_pourquoi', label: 'Pourquoi cet événement ?', type: 'textarea' },
                { name: 'contexte_historique', label: 'Historique des éditions', type: 'textarea' },
                { name: 'contexte_recurrent', label: 'Événement récurrent ?', type: 'text' },
                { name: 'contexte_interne', label: 'Contexte interne/externe', type: 'textarea' },
                { name: 'contexte_objectifs', label: 'Objectifs principaux', type: 'textarea' },
                { name: 'notes_5', label: 'Notes', type: 'textarea' }
            ],
            6: [
                { name: 'programme_timeline', label: 'Programme', type: 'timeline' },
                { name: 'notes_6', label: 'Notes', type: 'textarea' }
            ],
            7: [
                { name: 'concept_message', label: 'Message clé', type: 'textarea' },
                { name: 'concept_retenir', label: 'À retenir', type: 'textarea' },
                { name: 'concept_ambiance', label: 'Ambiance souhaitée', type: 'text' },
                { name: 'concept_parcours', label: 'Parcours attendu', type: 'textarea' },
                { name: 'concept_temps_forts', label: 'Temps forts', type: 'textarea' },
                { name: 'concept_interactions', label: 'Interactions', type: 'textarea' },
                { name: 'concept_animations', label: 'Animations', type: 'text' },
                { name: 'concept_speaker', label: 'Speaker', type: 'text' },
                { name: 'concept_digital', label: 'Digital / Gamification', type: 'text' },
                { name: 'concept_goodies', label: 'Cadeaux / Goodies', type: 'textarea' },
                { name: 'notes_7', label: 'Notes', type: 'textarea' }
            ],
            8: [
                { name: 'format_inspirations', label: 'Événements inspirants', type: 'textarea' },
                { name: 'format_univers', label: 'Univers visuels', type: 'textarea' },
                { name: 'format_marques', label: 'Marques de référence', type: 'textarea' },
                { name: 'format_moodboard', label: 'Moodboard', type: 'text' },
                { name: 'format_liens', label: 'Liens / Documents', type: 'textarea' },
                { name: 'notes_8', label: 'Notes', type: 'textarea' }
            ],
            9: [
                { name: 'lieu_reserve', label: 'Lieu déjà réservé ?', type: 'text' },
                { name: 'lieu_type', label: 'Type de lieu recherché', type: 'textarea' },
                { name: 'lieu_capacite', label: 'Capacité', type: 'text' },
                { name: 'lieu_contraintes', label: 'Contraintes d\'accès', type: 'textarea' },
                { name: 'lieu_hebergement', label: 'Hébergement nécessaire ?', type: 'text' },
                { name: 'technique_equipement', label: 'Équipement sur place', type: 'textarea' },
                { name: 'technique_electrique', label: 'Capacité électrique', type: 'text' },
                { name: 'technique_besoins', label: 'Besoins techniques', type: 'textarea' },
                { name: 'restauration_type', label: 'Type de restauration', type: 'array' },
                { name: 'restauration_regimes', label: 'Régimes spécifiques', type: 'textarea' },
                { name: 'notes_9', label: 'Notes', type: 'textarea' }
            ],
            10: [
                { name: 'charte_existe', label: 'Charte graphique existante ?', type: 'text' },
                { name: 'charte_documents', label: 'Documents fournis', type: 'textarea' },
                { name: 'charte_adaptation', label: 'Adaptation ou création ?', type: 'text' },
                { name: 'supports_prevoir', label: 'Supports à prévoir', type: 'array' },
                { name: 'supports_par_qui', label: 'Par qui ?', type: 'text' },
                { name: 'notes_10', label: 'Notes', type: 'textarea' }
            ],
            11: [
                { name: 'budget_global', label: 'Budget global estimé', type: 'text' },
                { name: 'budget_lieu', label: 'Budget Lieu', type: 'text' },
                { name: 'budget_technique', label: 'Budget Technique', type: 'text' },
                { name: 'budget_scenographie', label: 'Budget Scénographie', type: 'text' },
                { name: 'budget_restauration', label: 'Budget Restauration', type: 'text' },
                { name: 'budget_animations', label: 'Budget Animations', type: 'text' },
                { name: 'budget_transports', label: 'Budget Transports', type: 'text' },
                { name: 'budget_hebergements', label: 'Budget Hébergements', type: 'text' },
                { name: 'budget_goodies', label: 'Budget Goodies', type: 'text' },
                { name: 'budget_autres', label: 'Budget Autres', type: 'text' },
                { name: 'budget_prioritaires', label: 'Éléments prioritaires', type: 'textarea' },
                { name: 'budget_optionnels', label: 'Éléments optionnels', type: 'textarea' },
                { name: 'budget_arbitrages', label: 'Arbitrages possibles', type: 'textarea' },
                { name: 'notes_11', label: 'Notes', type: 'textarea' }
            ],
            12: [
                { name: 'contraintes_securite', label: 'Sécurité', type: 'textarea' },
                { name: 'contraintes_pmr', label: 'Accessibilité PMR', type: 'text' },
                { name: 'contraintes_reglementation', label: 'Réglementation', type: 'textarea' },
                { name: 'contraintes_confidentialite', label: 'Confidentialité', type: 'textarea' },
                { name: 'contraintes_techniques', label: 'Contraintes techniques', type: 'textarea' },
                { name: 'contraintes_horaires', label: 'Contraintes horaires', type: 'textarea' },
                { name: 'contraintes_sensibles', label: 'Points sensibles', type: 'textarea' },
                { name: 'contraintes_nondits', label: 'Non-dits identifiés', type: 'textarea' },
                { name: 'opportunites', label: 'Opportunités commerciales', type: 'textarea' },
                { name: 'notes_12', label: 'Notes', type: 'textarea' }
            ]
        };

        return fieldMappings[sectionId] || [];
    }

    function getFieldValue(name) {
        return formData[name];
    }

    function formatReviewValue(value, type) {
        if (!value || (Array.isArray(value) && value.length === 0)) {
            return '—';
        }

        if (type === 'timeline' && Array.isArray(value)) {
            return value.map(item => `<div>${item.time || '—'} : ${item.description || '—'}</div>`).join('');
        }

        if (type === 'array' && Array.isArray(value)) {
            return value.join(', ');
        }

        if (typeof value === 'string') {
            return value.replace(/\n/g, '<br>');
        }

        return value;
    }

    // ===========================================
    // EXPORT
    // ===========================================

    function exportToPDF() {
        showToast('Génération du PDF...', 'success');

        const content = generateExportHTML();
        const container = document.createElement('div');
        container.innerHTML = content;
        container.style.position = 'absolute';
        container.style.left = '-9999px';
        container.style.width = '210mm';
        document.body.appendChild(container);

        const opt = {
            margin: [15, 15, 15, 15],
            filename: `Brief_${formData.entreprise || 'Client'}_${formatDateForFile(new Date())}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                letterRendering: true
            },
            jsPDF: {
                unit: 'mm',
                format: 'a4',
                orientation: 'portrait'
            },
            pagebreak: { mode: 'avoid-all', before: '.page-break' }
        };

        html2pdf().set(opt).from(container).save().then(() => {
            document.body.removeChild(container);
            showToast('PDF généré avec succès !', 'success');
        }).catch(err => {
            document.body.removeChild(container);
            console.error('PDF generation error:', err);
            showToast('Erreur lors de la génération du PDF', 'error');
        });
    }

    function exportToClipboard() {
        const content = generateExportHTML();

        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = content;

        const plainText = generatePlainTextExport();

        navigator.clipboard.write([
            new ClipboardItem({
                'text/html': new Blob([content], { type: 'text/html' }),
                'text/plain': new Blob([plainText], { type: 'text/plain' })
            })
        ]).then(() => {
            showToast('Copié ! Collez dans Google Docs.', 'success');
        }).catch(err => {
            console.error('Clipboard error:', err);
            navigator.clipboard.writeText(plainText).then(() => {
                showToast('Copié en texte simple !', 'success');
            }).catch(() => {
                showToast('Erreur lors de la copie', 'error');
            });
        });
    }

    function generateExportHTML() {
        const date = formatDate(new Date());

        let html = `
            <div style="font-family: 'DM Sans', Arial, sans-serif; color: #1A1A1A; background: #FFFFFF; padding: 20px; max-width: 800px; margin: 0 auto;">
                <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #E94A8A;">
                    <h1 style="font-family: 'Bebas Neue', Arial, sans-serif; font-size: 36px; color: #E94A8A; letter-spacing: 3px; margin: 0;">BRIEF CLIENT</h1>
                    <p style="color: #666; margin-top: 10px;">Généré le ${date}</p>
                </div>
        `;

        SECTIONS.forEach(section => {
            const fields = getSectionFields(section.id);
            const hasContent = fields.some(f => {
                const val = getFieldValue(f.name);
                return val && (Array.isArray(val) ? val.length > 0 : val.toString().trim() !== '');
            });

            html += `
                <div style="margin-bottom: 25px; page-break-inside: avoid;">
                    <h2 style="font-family: 'Bebas Neue', Arial, sans-serif; font-size: 18px; color: #E94A8A; letter-spacing: 2px; margin-bottom: 15px; padding: 10px; background: #f8f8f8; border-left: 4px solid #E94A8A;">
                        ${String(section.id).padStart(2, '0')} — ${section.name.toUpperCase()}
                    </h2>
            `;

            if (hasContent) {
                fields.forEach(field => {
                    const value = getFieldValue(field.name);
                    const displayValue = formatReviewValue(value, field.type);

                    if (displayValue !== '—') {
                        html += `
                            <div style="display: flex; margin-bottom: 8px; padding: 8px 0; border-bottom: 1px solid #eee;">
                                <span style="min-width: 180px; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">${field.label}</span>
                                <span style="flex: 1; color: #1A1A1A;">${displayValue}</span>
                            </div>
                        `;
                    }
                });
            } else {
                html += `<p style="color: #999; font-style: italic;">Aucune information renseignée</p>`;
            }

            html += `</div>`;
        });

        html += `
                <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #999; font-size: 12px;">
                    <p>Brief généré avec Future Ready Brief Tool</p>
                </div>
            </div>
        `;

        return html;
    }

    function generatePlainTextExport() {
        const date = formatDate(new Date());
        let text = `BRIEF CLIENT\nGénéré le ${date}\n${'='.repeat(50)}\n\n`;

        SECTIONS.forEach(section => {
            text += `${String(section.id).padStart(2, '0')} — ${section.name.toUpperCase()}\n${'-'.repeat(40)}\n`;

            const fields = getSectionFields(section.id);
            fields.forEach(field => {
                const value = getFieldValue(field.name);
                let displayValue = '—';

                if (value) {
                    if (field.type === 'timeline' && Array.isArray(value)) {
                        displayValue = value.map(item => `  ${item.time || '—'} : ${item.description || '—'}`).join('\n');
                    } else if (Array.isArray(value)) {
                        displayValue = value.join(', ');
                    } else {
                        displayValue = value;
                    }
                }

                text += `${field.label}: ${displayValue}\n`;
            });

            text += '\n';
        });

        return text;
    }

    // ===========================================
    // UTILITIES
    // ===========================================

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    function formatDate(date) {
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function formatDateForFile(date) {
        return date.toISOString().split('T')[0];
    }

    function showToast(message, type = 'success') {
        const container = elements.toastContainer();
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span class="toast-message">${message}</span>`;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ===========================================
    // START
    // ===========================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
