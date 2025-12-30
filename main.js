
        document.addEventListener('DOMContentLoaded', function() {
            // Initialize projects
            const projectContainer = document.getElementById('projectCardsContainer');
            let currentLang = localStorage.getItem('preferredLanguage') || 'en';
            
            // Render projects on page load
            if (typeof projectsData !== 'undefined' && projectContainer) {
                renderProjects(projectsData, currentLang, projectContainer);
            }
            
            // Mobile navigation toggle
            const hamburger = document.getElementById('hamburger');
            const navLinks = document.getElementById('navLinks');
            
            if (hamburger && navLinks) {
                hamburger.addEventListener('click', function(e) {
                    console.log('Hamburger clicked');
                    e.stopPropagation();
                    navLinks.classList.toggle('active');
                    this.innerHTML = navLinks.classList.contains('active') 
                        ? '<i class="fas fa-times"></i>' 
                        : '<i class="fas fa-bars"></i>';
                    console.log('Nav menu toggled, active:', navLinks.classList.contains('active'));
                });
                
                // Close menu when clicking outside
                document.addEventListener('click', function(e) {
                    if (navLinks.classList.contains('active') && 
                        !navLinks.contains(e.target) && 
                        e.target !== hamburger && 
                        !hamburger.contains(e.target)) {
                        navLinks.classList.remove('active');
                        hamburger.innerHTML = '<i class="fas fa-bars"></i>';
                    }
                });
                
                // Smooth scrolling for navigation links
                document.querySelectorAll('a[href^="#"]').forEach(anchor => {
                    anchor.addEventListener('click', function(e) {
                        e.preventDefault();
                        
                        // Close mobile menu if open
                        if (navLinks.classList.contains('active')) {
                            navLinks.classList.remove('active');
                            hamburger.innerHTML = '<i class="fas fa-bars"></i>';
                        }
                        
                        const targetId = this.getAttribute('href');
                        if (targetId === '#') return;
                        
                        const targetElement = document.querySelector(targetId);
                        if (targetElement) {
                            window.scrollTo({
                                top: targetElement.offsetTop - 80,
                                behavior: 'smooth'
                            });
                        }
                    });
                });
            }
            
            // Better touch experience for projects
            if ('ontouchstart' in window || navigator.maxTouchPoints) {
                document.querySelectorAll('.project-card').forEach(card => {
                    card.classList.add('touch-device');
                    
                    // Optional: Add tap highlight animation for mobile
                    card.addEventListener('touchstart', function() {
                        this.classList.add('touch-active');
                    });
                    
                    card.addEventListener('touchend', function() {
                        this.classList.remove('touch-active');
                    });
                });
            }

            // Language Switcher Functionality
            const langToggle = document.getElementById('langToggle');
            const langText = langToggle.querySelector('.lang-text');
            
            // Update button text based on current language
            langText.textContent = currentLang.toUpperCase();

            langToggle.addEventListener('click', function() {
                // Toggle language
                currentLang = currentLang === 'en' ? 'ru' : 'en';
                
                // Update button text
                langText.textContent = currentLang.toUpperCase();
                
                // Re-render projects with new language
                if (typeof projectsData !== 'undefined' && projectContainer) {
                    renderProjects(projectsData, currentLang, projectContainer);
                    
                    // Re-setup lightbox handlers after re-render
                    setTimeout(() => {
                        if (typeof setupLightboxHandlers === 'function') {
                            setupLightboxHandlers();
                        }
                    }, 100);
                }
                
                // Show/hide static elements based on language
                document.querySelectorAll('.lang-en').forEach(el => {
                    el.style.display = currentLang === 'en' ? '' : 'none';
                });
                
                document.querySelectorAll('.lang-ru').forEach(el => {
                    el.style.display = currentLang === 'ru' ? '' : 'none';
                });
                
                // Fix for specific elements with different display types
                document.querySelectorAll('.nav-links a').forEach(link => {
                    if (link.classList.contains('lang-' + currentLang)) {
                        link.style.display = 'block';
                    } else {
                        link.style.display = 'none';
                    }
                });

                // Fix for buttons that should be inline-block
                document.querySelectorAll('.btn.lang-' + currentLang).forEach(btn => {
                    btn.style.display = 'inline-block';
                });

                // Fix for CV container
                document.querySelectorAll('.cv-container').forEach(container => {
                    if (container.classList.contains('lang-' + currentLang)) {
                        container.style.display = 'block';
                    } else {
                        container.style.display = 'none';
                    }
                });

                // Update current search input reference
                currentSearchInput = currentLang === 'en' ? searchInputEn : searchInputRu;

                // Clear search and highlights when switching language
                if (currentSearchInput) {
                    currentSearchInput.value = '';
                    if (typeof removeHighlights === 'function') {
                        removeHighlights();
                    }
                    if (typeof clearButton !== 'undefined' && clearButton) {
                        clearButton.style.display = 'none';
                    }
                    if (typeof performSearch === 'function') {
                        performSearch();
                    }
                }

                // Remember the user's language preference
                localStorage.setItem('preferredLanguage', currentLang);
            });

            // Check for saved language preference and apply it
            if (currentLang !== 'en') {
                // Apply saved language preference
                langText.textContent = currentLang.toUpperCase();
                document.querySelectorAll('.lang-en').forEach(el => {
                    el.style.display = 'none';
                });
                document.querySelectorAll('.lang-ru').forEach(el => {
                    el.style.display = '';
                });
            }

            // Simple search with visual feedback
            let projectCards = document.querySelectorAll('.project-card');
            const searchInputEn = document.getElementById('projectSearch');
            const searchInputRu = document.getElementById('projectSearchRu');
            const clearButton = document.getElementById('clearSearch');
            const searchInfo = document.getElementById('searchInfo');
            const noResultsElement = document.getElementById('noResults');
            
            let currentSearchInput = currentLang === 'en' ? searchInputEn : searchInputRu;
            
            // Function to refresh project cards reference
            function refreshProjectCards() {
                projectCards = document.querySelectorAll('.project-card');
            }

            // Function to highlight matching text
            function highlightText(element, searchTerm) {
                if (!searchTerm || searchTerm.length < 2) return;
                
                const text = element.textContent;
                const regex = new RegExp(`(${searchTerm})`, 'gi');
                
                if (regex.test(text)) {
                    element.innerHTML = text.replace(regex, '<span class="highlight">$1</span>');
                }
            }

            // Function to remove highlights
            function removeHighlights() {
                document.querySelectorAll('.highlight').forEach(highlight => {
                    const parent = highlight.parentNode;
                    parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
                    parent.normalize();
                });
            }

            // Update search info display
            function updateSearchInfo(searchTerm, visibleCount, totalCount) {
                const infoEn = searchInfo.querySelector('.lang-en');
                const infoRu = searchInfo.querySelector('.lang-ru');
                
                if (!searchTerm || searchTerm.trim() === '') {
                    infoEn.textContent = 'All projects shown';
                    infoRu.textContent = 'Показаны все проекты';
                    searchInfo.style.backgroundColor = 'rgba(66, 133, 244, 0.1)';
                } else if (visibleCount === 0) {
                    infoEn.textContent = `No projects found for "${searchTerm}"`;
                    infoRu.textContent = `Не найдено проектов для "${searchTerm}"`;
                    searchInfo.style.backgroundColor = 'rgba(255, 99, 71, 0.1)';
                } else if (visibleCount === totalCount) {
                    infoEn.textContent = `All projects match "${searchTerm}"`;
                    infoRu.textContent = `Все проекты соответствуют "${searchTerm}"`;
                    searchInfo.style.backgroundColor = 'rgba(76, 175, 80, 0.1)';
                } else {
                    infoEn.textContent = `${visibleCount} of ${totalCount} projects found`;
                    infoRu.textContent = `Найдено ${visibleCount} из ${totalCount} проектов`;
                    searchInfo.style.backgroundColor = 'rgba(66, 133, 244, 0.1)';
                }
            }

            // Main search function
            function performSearch() {
                refreshProjectCards(); // Refresh reference to project cards
                const searchTerm = currentSearchInput.value.toLowerCase().trim();
                let visibleCount = 0;
                const totalCount = projectCards.length;

                // Remove previous highlights
                removeHighlights();

                // Show/hide clear button
                if (clearButton) {
                    clearButton.style.display = searchTerm ? 'flex' : 'none';
                }

                projectCards.forEach(card => {
                    let matches = false;

                    if (searchTerm === '') {
                        matches = true;
                    } else {
                        // Get visible elements based on current language
                        const titleElement = card.querySelector(`.project-title.lang-${currentLang}`);
                        const descriptionElement = card.querySelector(`.project-description.lang-${currentLang}`);
                        const techElements = card.querySelectorAll('.tech-tag');

                        // Check matches
                        const title = titleElement ? titleElement.textContent.toLowerCase() : '';
                        const description = descriptionElement ? descriptionElement.textContent.toLowerCase() : '';
                        const techStack = Array.from(techElements).map(tag => tag.textContent.toLowerCase());

                        matches = title.includes(searchTerm) || 
                                 description.includes(searchTerm) || 
                                 techStack.some(tech => tech.includes(searchTerm));

                        // Add highlights for matches
                        if (matches && searchTerm.length >= 2) {
                            if (titleElement && title.includes(searchTerm)) {
                                highlightText(titleElement, searchTerm);
                            }
                            if (descriptionElement && description.includes(searchTerm)) {
                                highlightText(descriptionElement, searchTerm);
                            }
                            techElements.forEach(techElement => {
                                if (techElement.textContent.toLowerCase().includes(searchTerm)) {
                                    highlightText(techElement, searchTerm);
                                }
                            });
                        }
                    }

                    // Show/hide project with smooth animation
                    if (matches) {
                        card.classList.remove('hidden');
                        visibleCount++;
                    } else {
                        card.classList.add('hidden');
                    }
                });

                // Update search info
                if (searchInfo) {
                    updateSearchInfo(searchTerm, visibleCount, totalCount);
                }

                // Show/hide no results message
                if (noResultsElement) {
                    if (visibleCount === 0 && searchTerm !== '') {
                        noResultsElement.style.display = 'block';
                    } else {
                        noResultsElement.style.display = 'none';
                    }
                }
            }

            // Clear search function
            function clearSearch() {
                currentSearchInput.value = '';
                removeHighlights();
                clearButton.style.display = 'none';
                performSearch();
                currentSearchInput.focus();
            }

            // Setup search input event listeners
            function setupSearchInput(input) {
                if (!input) return;

                input.addEventListener('input', performSearch);
                
                input.addEventListener('keydown', function(e) {
                    if (e.key === 'Escape') {
                        clearSearch();
                    }
                });
            }

            // Setup clear button
            if (clearButton) {
                clearButton.addEventListener('click', clearSearch);
            }

            // Initialize search inputs
            setupSearchInput(searchInputEn);
            setupSearchInput(searchInputRu);

            // Initial load - wait for projects to be rendered
            setTimeout(() => {
                refreshProjectCards();
                if (searchInfo) {
                    updateSearchInfo('', projectCards.length, projectCards.length);
                }
            }, 100);

            // === ANALYTICS SYSTEM ===
            
            // Configuration
            const ANALYTICS_URL = 'https://script.google.com/macros/s/AKfycbwYuMFiIcMYotbATQVOp1Gc1dUgtNnrw6rLlSsVF04NXw8mMXhibR3UYAotxOnX3YBilA/exec';
            
            // Generate or retrieve unique user ID
            function getUserId() {
                let userId = localStorage.getItem('portfolioUserId');
                if (!userId) {
                    userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                    localStorage.setItem('portfolioUserId', userId);
                }
                return userId;
            }

            // Get session ID (changes each visit)
            function getSessionId() {
                let sessionId = sessionStorage.getItem('portfolioSessionId');
                if (!sessionId) {
                    sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                    sessionStorage.setItem('portfolioSessionId', sessionId);
                }
                return sessionId;
            }

            // Get Almaty time (UTC+5)
            function getAlmatyTime() {
                const now = new Date();
                const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
                const almatyTime = new Date(utc + (5 * 3600000)); // UTC+5
                return almatyTime.toISOString().replace('T', ' ').slice(0, 19) + ' (UTC+5)';
            }

            // Get essential device info only
            function getEssentialDeviceInfo() {
                return {
                    devicePlatform: navigator.platform,
                    deviceType: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop',
                    screenSize: screen.width + 'x' + screen.height,
                    browserLanguage: navigator.language,
                    referrer: document.referrer || 'direct'
                };
            }

            // Track session start time
            let sessionStartTime = Date.now();
            let pageStartTime = Date.now();

            // Main function to send analytics data
            function trackEvent(eventType, eventData = {}) {
                const deviceInfo = getEssentialDeviceInfo();
                
                const data = {
                    // Basic info
                    timestamp: getAlmatyTime(),
                    userId: getUserId(),
                    sessionId: getSessionId(),
                    eventType: eventType,
                    
                    // Page context
                    currentLanguage: currentLang,
                    
                    // Device info (only essential)
                    devicePlatform: deviceInfo.devicePlatform,
                    deviceType: deviceInfo.deviceType,
                    screenSize: deviceInfo.screenSize,
                    browserLanguage: deviceInfo.browserLanguage,
                    referrer: deviceInfo.referrer,
                    
                    // Time tracking
                    timeOnPageSeconds: Math.round((Date.now() - pageStartTime) / 1000),
                    totalSessionSeconds: Math.round((Date.now() - sessionStartTime) / 1000),
                    
                    // Event specific data
                    ...eventData
                };

                // Send to Google Sheets
                fetch(ANALYTICS_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data)
                }).catch(error => {
                    console.log('Analytics tracking failed:', error);
                });
                
                // Debug log
                console.log('📊 Event tracked:', eventType, eventData);
            }
            
            // Make trackEvent globally accessible for chatbot
            window.trackEvent = trackEvent;

            // Track page load - wait for projects to be rendered
            setTimeout(() => {
                refreshProjectCards();
                trackEvent('page_load', {
                    totalProjects: projectCards.length,
                    loadTimeMs: performance.now()
                });
            }, 100);

            // Track language switches
            langToggle.addEventListener('click', function(e) {
                trackEvent('language_switch', {
                    fromLanguage: currentLang,
                    toLanguage: currentLang === 'en' ? 'ru' : 'en'
                });
            });

            // Track all clicks with proper categorization
            document.addEventListener('click', function(e) {
                const target = e.target.closest('a, button');
                if (!target) return;

                const href = target.href || '';
                const buttonText = target.textContent.trim();

                // Social media clicks
                if (href.includes('linkedin.com')) {
                    trackEvent('social_click', { socialPlatform: 'linkedin', buttonText: buttonText });
                } else if (href.includes('instagram.com')) {
                    trackEvent('social_click', { socialPlatform: 'instagram', buttonText: buttonText });
                } else if (href.includes('t.me')) {
                    trackEvent('social_click', { socialPlatform: 'telegram', buttonText: buttonText });
                } else if (href.includes('github.com')) {
                    trackEvent('social_click', { socialPlatform: 'github', buttonText: buttonText });
                    
                // CV downloads
                } else if (href.includes('.pdf')) {
                    trackEvent('cv_download', { 
                        language: currentLang, 
                        filename: href.split('/').pop(),
                        buttonText: buttonText
                    });
                    
                // Presentation clicks
                } else if (href.includes('canva.com')) {
                    trackEvent('presentation_click', { 
                        buttonText: buttonText,
                        language: currentLang
                    });
                    
                // Navigation clicks
                } else if (href.startsWith('#')) {
                    trackEvent('navigation_click', { 
                        section: href.replace('#', ''),
                        buttonText: buttonText
                    });
                    
                // Other buttons
                } else if (target.classList.contains('btn') || target.tagName === 'BUTTON') {
                    trackEvent('button_click', { 
                        buttonText: buttonText,
                        buttonType: target.className
                    });
                }
                
                // Special case for clear search
                if (target.id === 'clearSearch') {
                    trackEvent('search_clear');
                }
            });

            // Track search behavior (fixed)
            let searchTimeout;
            function trackSearchEvent() {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    const searchTerm = currentSearchInput.value.trim();
                    if (searchTerm.length > 0) {
                        const visibleProjects = document.querySelectorAll('.project-card:not(.hidden)').length;
                        trackEvent('search_performed', {
                            searchTerm: searchTerm,
                            resultsFound: visibleProjects,
                            language: currentLang
                        });
                    }
                }, 1500); // Wait 1.5 seconds after user stops typing
            }

            // Add search tracking to both inputs
            if (searchInputEn) {
                searchInputEn.addEventListener('input', trackSearchEvent);
            }
            if (searchInputRu) {
                searchInputRu.addEventListener('input', trackSearchEvent);
            }

            // Track email/phone copy attempts
            document.addEventListener('copy', function(e) {
                const selection = window.getSelection().toString();
                if (selection.includes('arsen801777@gmail.com')) {
                    trackEvent('contact_copy', { contactType: 'email', contactValue: 'arsen801777@gmail.com' });
                } else if (selection.includes('+7 707 446 6793')) {
                    trackEvent('contact_copy', { contactType: 'phone', contactValue: '+7 707 446 6793' });
                }
            });

            // Track project views and clicks - setup after projects are rendered
            function setupProjectTracking() {
                refreshProjectCards();
                projectCards.forEach((card, index) => {
                    const titleElement = card.querySelector(`.project-title.lang-${currentLang}`);
                    if (!titleElement) return;
                    
                    const projectTitle = titleElement.textContent.trim();
                    
                    // Track when project comes into view
                    const observer = new IntersectionObserver((entries) => {
                        entries.forEach(entry => {
                            if (entry.isIntersecting) {
                                trackEvent('project_view', {
                                    projectTitle: projectTitle,
                                    projectIndex: index + 1,
                                    language: currentLang
                                });
                                observer.unobserve(entry.target);
                            }
                        });
                    }, { threshold: 0.6 });
                    
                    observer.observe(card);

                    // Track project card clicks (not links)
                    card.addEventListener('click', function(e) {
                        if (!e.target.closest('a')) {
                            trackEvent('project_click', {
                                projectTitle: projectTitle,
                                projectIndex: index + 1,
                                language: currentLang
                            });
                        }
                    });
                });
            }
            
            // Setup tracking after initial render
            setTimeout(setupProjectTracking, 100);

            // Track CV iframe views
            const cvIframes = document.querySelectorAll('.cv-container iframe');
            cvIframes.forEach(iframe => {
                iframe.addEventListener('load', function() {
                    trackEvent('cv_view', { language: currentLang });
                });
            });

            // Track page visibility changes
            document.addEventListener('visibilitychange', function() {
                if (document.hidden) {
                    trackEvent('page_blur', {
                        timeBeforeBlurSeconds: Math.round((Date.now() - pageStartTime) / 1000)
                    });
                } else {
                    pageStartTime = Date.now(); // Reset page timer
                    trackEvent('page_focus');
                }
            });

            // Track when user leaves page
            window.addEventListener('beforeunload', function() {
                trackEvent('session_end', {
                    totalSessionTimeSeconds: Math.round((Date.now() - sessionStartTime) / 1000),
                    finalTimeOnPageSeconds: Math.round((Date.now() - pageStartTime) / 1000)
                });
            });

            // Track scroll milestones
            let maxScrollDepth = 0;
            window.addEventListener('scroll', function() {
                const scrollDepth = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
                if (scrollDepth > maxScrollDepth) {
                    maxScrollDepth = scrollDepth;
                    // Only track major milestones
                    if ([25, 50, 75, 100].includes(maxScrollDepth)) {
                        trackEvent('scroll_milestone', { scrollDepth: maxScrollDepth });
                    }
                }
            });

            // === LIGHTBOX FUNCTIONALITY ===
            
            // Check if device is mobile
            const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
            
            // Only initialize lightbox on desktop devices
            if (!isMobile) {
                const lightbox = document.getElementById('lightbox');
                const lightboxImage = document.getElementById('lightboxImage');
                const lightboxTitle = document.getElementById('lightboxTitle');
                const lightboxClose = document.getElementById('lightboxClose');

                // Function to open lightbox
                function openLightbox(imageSrc, imageAlt, projectTitle) {
                    lightboxImage.src = imageSrc;
                    lightboxImage.alt = imageAlt;
                    lightboxTitle.textContent = projectTitle || imageAlt;
                    
                    // Prevent body scroll
                    document.body.style.overflow = 'hidden';
                    
                    // Show lightbox with animation
                    lightbox.style.display = 'flex';
                    requestAnimationFrame(() => {
                        lightbox.classList.add('active');
                    });

                    // Track lightbox view
                    trackEvent('image_lightbox_open', {
                        imageName: imageSrc.split('/').pop(),
                        projectTitle: projectTitle || imageAlt,
                        language: currentLang
                    });
                }

                // Function to close lightbox
                function closeLightbox() {
                    lightbox.classList.remove('active');
                    document.body.style.overflow = '';
                    
                    setTimeout(() => {
                        lightbox.style.display = 'none';
                        lightboxImage.src = '#';
                        lightboxImage.style.display = 'none';
                    }, 300);

                    trackEvent('image_lightbox_close');
                }

                // Function to setup lightbox for project images
                function setupLightboxHandlers() {
                    document.querySelectorAll('.project-media img').forEach(img => {
                        // Remove existing listeners to avoid duplicates
                        const newImg = img.cloneNode(true);
                        img.parentNode.replaceChild(newImg, img);
                        
                        newImg.addEventListener('click', function(e) {
                            e.stopPropagation();
                            
                            // Get project title from the same card
                            const projectCard = this.closest('.project-card');
                            const titleElement = projectCard.querySelector(`.project-title.lang-${currentLang}`);
                            const projectTitle = titleElement ? titleElement.textContent.trim() : '';
                            
                            openLightbox(this.src, this.alt, projectTitle);
                        });
                    });
                }
                
                // Setup lightbox handlers after projects are rendered
                setTimeout(setupLightboxHandlers, 100);
                
                // Re-setup when language changes - handled in language toggle

                // Close lightbox when clicking close button
                lightboxClose.addEventListener('click', function(e) {
                    e.stopPropagation();
                    closeLightbox();
                });

                // Close lightbox when clicking outside the image
                lightbox.addEventListener('click', function(e) {
                    if (e.target === lightbox) {
                        closeLightbox();
                    }
                });

                // Close lightbox with ESC key
                document.addEventListener('keydown', function(e) {
                    if (e.key === 'Escape' && lightbox.classList.contains('active')) {
                        closeLightbox();
                    }
                });

                // Prevent lightbox content clicks from closing
                document.querySelector('.lightbox-content').addEventListener('click', function(e) {
                    e.stopPropagation();
                });
            } else {
                // On mobile devices, remove cursor pointer and hover effects from images
                document.querySelectorAll('.project-media img').forEach(img => {
                    img.style.cursor = 'default';
                });
            }
        });