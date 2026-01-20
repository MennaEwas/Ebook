// App State
const TOTAL_SLIDES = 16;
let currentSlide = 0;
let activityCompleted = false;
const completedSlides = new Set();

/* Audio state */
let currentAudio = null;
let currentAudioBtn = null;

// AudioContext for page flip sound (initialized on first user interaction)
let audioContext = null;

// Initialize AudioContext on first user interaction
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
}

// Generate and play page flip sound effect
function playPageFlipSound() {
    try {
        const ctx = initAudioContext();
        
        // Duration: 0.3 seconds
        const duration = 0.3;
        const sampleRate = ctx.sampleRate;
        const buffer = ctx.createBuffer(1, duration * sampleRate, sampleRate);
        const data = buffer.getChannelData(0);
        
        // Generate pink noise (more natural than white noise)
        // Pink noise has equal energy per octave
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < data.length; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
            data[i] *= 0.11; // Normalize
            b6 = white * 0.115926;
        }
        
        // Create buffer source
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        
        // Create gain node for volume control and envelope
        const gainNode = ctx.createGain();
        
        // Apply envelope: quick fade-in, then fade-out
        const now = ctx.currentTime;
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.15, now + 0.05); // Fade in quickly
        gainNode.gain.linearRampToValueAtTime(0.15, now + 0.15); // Sustain
        gainNode.gain.linearRampToValueAtTime(0, now + duration); // Fade out
        
        // Connect nodes
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        
        // Play the sound
        source.start(0);
        source.stop(now + duration);
    } catch (error) {
        // Silently fail if audio context is not available
        console.debug("Page flip sound unavailable:", error);
    }
}

// Winning sound helper
function playWinSound() {
    const sound = document.getElementById("winningSound");
    if (!sound) return;
    try {
        sound.currentTime = 0;
        sound.play().catch(() => {});
    } catch (error) {
        console.debug("Win sound unavailable:", error);
    }
}

// Initialize intro section and start button
document.addEventListener("DOMContentLoaded", () => {
    const startBtn = document.getElementById("start-reading-btn");
    const introSection = document.getElementById("intro-section");
    const ebookWrapper = document.getElementById("ebook-wrapper");

    if (startBtn && introSection && ebookWrapper) {
        // Intro section exists - wait for button click before initializing
        startBtn.addEventListener("click", () => {
            // Always reset progress when starting
            localStorage.removeItem('ebook-progress');
            currentSlide = 0;
            activityCompleted = false;
            completedSlides.clear();

            // Hide intro section
            introSection.classList.add("hidden");
            // Show e-book wrapper
            ebookWrapper.style.display = "block";
            ebookWrapper.classList.add("show");
            // Scroll to top
            window.scrollTo(0, 0);
            // Initialize e-book app
            loadProgress(); // will default to slide 0 after reset
            initProgressIndicator();
            initNavigation();
            loadSlide(0);
        });
    } else {
        // If intro elements don't exist, initialize app normally (backward compatibility)
        loadProgress();
        initProgressIndicator();
        initNavigation();
        loadSlide(currentSlide);
    }
  });

// Load progress from localStorage
function loadProgress() {
    const saved = localStorage.getItem("ebook-progress");
    if (!saved) return;
  
    const progress = JSON.parse(saved);
    currentSlide = progress.currentSlide ?? 0;
    completedSlides.clear();
    (progress.completedSlides || []).forEach(i => completedSlides.add(i));
  }

// Save progress to localStorage
function saveProgress() {
    localStorage.setItem(
      "ebook-progress",
      JSON.stringify({
        currentSlide,
        completedSlides: Array.from(completedSlides),
      })
    );
}

// Initialize progress indicator dots
function initProgressIndicator() {
    const indicator = document.querySelector(".progress-indicator");
    indicator.innerHTML = "";
  
    for (let i = 0; i < TOTAL_SLIDES; i++) {
      const dot = document.createElement("div");
      dot.className = "progress-dot";
      indicator.appendChild(dot);
    }
  
    updateProgressIndicator();
  }

// Update progress indicator
function updateProgressIndicator() {
    document.querySelectorAll(".progress-dot").forEach((dot, i) => {
      dot.classList.remove("active", "completed");
      if (i === currentSlide) dot.classList.add("active");
      else if (completedSlides.has(i)) dot.classList.add("completed");
    });
  }

// Initialize navigation
function initNavigation() {
    document.querySelector(".prev-btn").onclick = () => {
      if (currentSlide > 0) {
        playPageFlipSound();
        loadSlide(currentSlide - 1, "prev");
      }
    };
  
    document.querySelector(".next-btn").onclick = () => {
      if (currentSlide < TOTAL_SLIDES - 1 && activityCompleted) {
        playPageFlipSound();
        loadSlide(currentSlide + 1, "next");
      }
    };
  }

function stopAudio() {
    if (!currentAudio) return;
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
    if (currentAudioBtn) {
      currentAudioBtn.classList.remove("playing");
      currentAudioBtn.textContent = "🔊 Listen";
      currentAudioBtn = null;
    }
  }
  

// Load a slide from pages/slideXX.html (relative path)
async function loadSlide(slideIndex, direction = 'next') {
    if (slideIndex < 0 || slideIndex >= TOTAL_SLIDES) return;

    const container = document.getElementById('content') || document.querySelector('.page-container');
    
    // Stop any currently playing audio when navigating
    stopCurrentAudio();
    
    // Get current page for exit animation
    const currentPage = container.querySelector('.page.active');
    if (currentPage) {
        // Add exit animation class based on direction
        if (direction === 'next') {
            currentPage.classList.add('flip-next');
        } else {
            currentPage.classList.add('flip-prev');
        }
    }

    const slideNumber = String(slideIndex + 1).padStart(2, '0');
    // Use a relative path so it works whether the app is at the web root or a subfolder
    const url = `pages/slide${slideNumber}.html`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to load slide');
        }
        const html = await response.text();
        
        // Wait for exit animation to complete (halfway through)
        await new Promise(resolve => setTimeout(resolve, 350));
        
        const contentEl = document.getElementById('content');
        if (contentEl) {
            contentEl.innerHTML = html;
            // CRITICAL INTEGRATION: Initialize vocabulary matching immediately after HTML injection
            if (document.querySelector('.matching-container')) {
                initVocabularyMatching();
            }
        } else {
            container.innerHTML = html;
        }
        
        // Ensure the loaded page is visible and add enter animation
        const loadedPage = container.querySelector('.page');
        if (loadedPage) {
            loadedPage.classList.add('active', 'page-enter');
            if (direction === 'next') {
                loadedPage.classList.add('flip-next');
            } else {
                loadedPage.classList.add('flip-prev');
            }
            
            // Initialize audio narration for this slide
            initAudioNarration(slideIndex);
            
            // Remove animation classes after transition completes
            setTimeout(() => {
                loadedPage.classList.remove('flip-next', 'flip-prev', 'page-enter');
            }, 700);
        }
    } catch (error) {
        container.innerHTML = `<div class="activity-area"><p>Sorry, this slide could not be loaded.</p></div>`;
    }

    currentSlide = slideIndex;
    // Small delay to ensure DOM is ready before initializing interactions
    setTimeout(() => {
        initSlideForIndex(currentSlide);
    }, 10);
    // Reset completion when navigating to a slide; it must be completed again
    activityCompleted = false;
    saveProgress();
    updateUI();
    window.scrollTo(0, 0);
}


// Stop currently playing audio
function stopCurrentAudio() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
        
        // Update button state
        const playingBtn = document.querySelector('.audio-narration-btn.playing');
        if (playingBtn) {
            playingBtn.classList.remove('playing');
            playingBtn.textContent = '🔊 Listen';
        }
    }
}

// Initialize audio narration for current slide
function stopAudio() {
    if (!currentAudio) return;
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
    if (currentAudioBtn) {
      currentAudioBtn.classList.remove("playing");
      currentAudioBtn.textContent = "🔊 Listen";
      currentAudioBtn = null;
    }
  }
  
  function initAudioNarration(slideIndex) {
    // Skip narration on winning slide (index 15 => slide16)
    if (slideIndex === 15) return;
    const page = document.querySelector(".page.active");
    if (!page) return;
  
    const title = page.querySelector(".page-title");
    if (!title) return;
  
    let btn = page.querySelector(".audio-narration-btn");
    if (!btn) {
      btn = document.createElement("button");
      btn.className = "audio-narration-btn";
      btn.textContent = "🔊 Listen";
      title.after(btn);
    }
  
    const slideNum = String(slideIndex + 1).padStart(2, "0");
    const audio = new Audio(`assets/audio/slide${slideNum}.mp3`);
    audio.preload = "metadata";
  
    btn.onclick = () => {
      if (currentAudio && currentAudio !== audio) stopAudio();
  
      if (audio.paused) {
        audio.play().catch(() => btn.style.display = "none");
        btn.classList.add("playing");
        btn.textContent = "⏸ Pause";
        currentAudio = audio;
        currentAudioBtn = btn;
      } else {
        stopAudio();
      }
    };
  
    audio.onended = stopAudio;
    audio.onerror = () => btn.style.display = "none";
  }


// Update UI (navigation buttons, progress)
function updateUI() {
    const prev = document.querySelector(".prev-btn");
    const next = document.querySelector(".next-btn");
  
    prev.disabled = currentSlide === 0;
  
    if (currentSlide === TOTAL_SLIDES - 1) {
      next.disabled = true;
      next.classList.remove("locked");
    } else {
      next.disabled = !activityCompleted;
      next.classList.toggle("locked", !activityCompleted);
    }
  
    updateProgressIndicator();
  }

// Global rule: completion resets when navigating back.
// We only unlock Next when the current slide calls markActivityComplete().

// Reusable activity completion helper
// Called by each slide when its activity is successfully completed
function markActivityComplete(feedback, message, status = "info") {
  if (feedback) {
    feedback.textContent = message;
    feedback.className = `feedback-area show ${status}`;
  }
  activityCompleted = true;
  completedSlides.add(currentSlide);
  saveProgress();
  updateUI();
}

// SLIDE 1 - Cover Page
function initSlide1() {
    const page = document.querySelector('.page');
    if (!page) return;

    const startBtn = page.querySelector('.start-reading-btn');
    const feedback = page.querySelector('.feedback-area');

    if (startBtn) {
        startBtn.addEventListener('click', () => {
            markActivityComplete(
                feedback,
                "Good prediction! Let's begin.",
                'correct'
            );
        });
    }
}

// SLIDE 2 - Weekly Question
function initSlide2() {
    const page = document.querySelector('.page');
    if (!page) return;

    const buttons = page.querySelectorAll('.choice-btn');
    const feedback = page.querySelector('.feedback-area');

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove selected class from all buttons
            buttons.forEach(btn => btn.classList.remove('selected'));
            
            // Highlight the clicked button
            button.classList.add('selected');
            
            // Check if correct and show appropriate feedback
            const isCorrect = button.hasAttribute('data-correct');
            const message = isCorrect 
                ? 'Great choice! Being patient is an important way to reach goals.'
                : 'Think about what helps people achieve their goals.';
            const status = isCorrect ? 'correct' : 'incorrect';
            
            // Show feedback and mark activity complete
            markActivityComplete(feedback, message, status);
        });
    });
}

// SLIDE 3 - Shuffle matching answers so order changes each time
function initSlide3() {
    const page = document.querySelector('.page');
    if (!page) return;

    const defs = page.querySelector('.matching-definitions');
    if (defs) {
        const items = Array.from(defs.children);
        for (let i = items.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            defs.appendChild(items[j]);
            items.splice(j, 1);
        }
    }

    // Reuse existing matching logic for drag/drop
    initVocabularyMatching();
}

// SLIDE 4 - Weekly Question (Trusting Pip)
function initSlide4() {
    const page = document.querySelector('.page');
    if (!page) return;

    const cards = page.querySelectorAll('.trust-card');
    const feedback = page.querySelector('.feedback-area');

    if (!cards.length || !feedback) return;

    cards.forEach(card => {
        card.addEventListener('click', () => {
            // Clear previous selection
            cards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');

            const option = card.dataset.option;
            let message = '';
            let status = 'incorrect';

            if (option === 'food') {
                message = 'Good choice! Patience helps build trust.';
                status = 'correct';
                markActivityComplete(feedback, message, status);
            } else if (option === 'grab') {
                message = 'Grabbing Pip quickly might scare him and make him run away.';
                feedback.textContent = message;
                feedback.className = 'feedback-area show incorrect';
            } else if (option === 'ignore') {
                message = 'If Katya ignores Pip, it will be harder for them to become friends.';
                feedback.textContent = message;
                feedback.className = 'feedback-area show incorrect';
            }
        });
    });
}

// SLIDE 5 - Genre Focus (Realistic vs Fantasy)
function initSlide5() {
    const page = document.querySelector('.page');
    if (!page) return;

    const cards = page.querySelectorAll('.genre-card');
    const feedback = page.querySelector('.feedback-area');

    if (!cards.length || !feedback) return;

    cards.forEach(card => {
        card.addEventListener('click', () => {
            // Clear previous selection
            cards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');

            const type = card.dataset.type;

            if (type === 'fantasy' && card.hasAttribute('data-correct')) {
                // Correct: the fantasy event
                markActivityComplete(
                    feedback,
                    'Yes! That would be fantasy.',
                    'correct'
                );
            } else if (type === 'realistic') {
                // Calm, reflective feedback for realistic events
                feedback.textContent = 'This could really happen in a story about Katya and Pip.';
                feedback.className = 'feedback-area show info';
            }
        });
    });
}

// SLIDE 6 - Plot Elements (Story Hill)
function initSlide6() {
    // Attach only when the story-hill activity exists
    const hill = document.querySelector('.story-hill');
    if (!hill) return;

    const page = document.querySelector('.page');
    if (!page) return;

    const items = page.querySelectorAll('.sequence-item');
    const slots = page.querySelectorAll('.sequence-slot');
    const feedback = page.querySelector('.feedback-area');

    if (!items.length || !slots.length || !feedback) return;

    let draggedItem = null;

    items.forEach(item => {
        item.addEventListener('dragstart', (e) => {
            if (item.style.display === 'none') {
                e.preventDefault();
                return;
            }
            draggedItem = item;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            // keep draggedItem until drop completes
        });
    });

    slots.forEach(slot => {
        slot.addEventListener('dragover', (e) => {
            // Don't allow changing a completed slot
            if (slot.classList.contains('correct')) return;
            e.preventDefault();
            slot.classList.add('drag-over');
        });

        slot.addEventListener('dragleave', () => {
            slot.classList.remove('drag-over');
        });

        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            slot.classList.remove('drag-over');

            if (!draggedItem) return;
            if (slot.classList.contains('correct')) return;

            const expected = String(slot.dataset.slot);
            const actual = String(draggedItem.dataset.order);
            const isCorrect = expected === actual;

            // Clear any previous dropped content (only if not correct yet)
            const existing = slot.querySelector('.dropped-item');
            if (existing) existing.remove();

            if (isCorrect) {
                // Lock correct placement
                const dropped = document.createElement('div');
                dropped.className = 'dropped-item';
                dropped.textContent = draggedItem.textContent;
                slot.appendChild(dropped);

                slot.classList.add('correct');
                draggedItem.style.display = 'none';

                // Check completion: all items placed
                const allPlaced = Array.from(items).every(i => i.style.display === 'none');
                if (allPlaced) {
                    markActivityComplete(
                        feedback,
                        'You built the story!',
                        'correct'
                    );
                } else {
                    feedback.textContent = 'Nice! Keep building the hill.';
                    feedback.className = 'feedback-area show info';
                }
            } else {
                feedback.textContent = 'Not quite. Try a different spot on the hill.';
                feedback.className = 'feedback-area show incorrect';
            }

            draggedItem = null;
        });
    });
}

// SLIDE 7 - Kindness Quick Pick (simple multiple choice)
function initSlide7() {
    const page = document.querySelector('.page');
    if (!page) return;

    const buttons = page.querySelectorAll('.quiz-choice');
    const feedback = page.querySelector('.feedback-area');

    if (!buttons.length || !feedback) return;

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');

            const isCorrect = btn.hasAttribute('data-correct');
            if (isCorrect) {
                markActivityComplete(
                    feedback,
                    'Great choice! Pip feels safe when we are gentle and caring.',
                    'correct'
                );
            } else {
                feedback.textContent = 'Try again. Which choice helps Pip feel calm and safe?';
                feedback.className = 'feedback-area show incorrect';
            }
        });
    });
}

// Vocabulary Matching Drag-and-Drop (MANDATORY IMPLEMENTATION)
function initVocabularyMatching() {
    // Select elements using querySelectorAll
    const words = document.querySelectorAll('.match-word');
    const definitions = document.querySelectorAll('.match-definition');
    const feedback = document.querySelector('.feedback-area');

    if (!words.length || !definitions.length) return;

    // Track matched count
    let matchedCount = 0;
    const totalWords = words.length;

    // For each .match-word element: Add dragstart listener
    words.forEach(word => {
        word.addEventListener('dragstart', (e) => {
            // Only allow dragging if not already matched
            if (!word.classList.contains('matched')) {
                e.dataTransfer.setData('text/plain', word.dataset.match);
                e.dataTransfer.effectAllowed = 'move';
            } else {
                e.preventDefault();
            }
        });
    });

    // For each .match-definition element: Add dragover and drop listeners
    definitions.forEach(def => {
        // Add dragover listener
        def.addEventListener('dragover', (e) => {
            // Only allow drop if definition is not already matched
            if (!def.classList.contains('correct')) {
                e.preventDefault(); // REQUIRED
                e.dataTransfer.dropEffect = 'move';
            }
        });

        // Add drop listener
        def.addEventListener('drop', (e) => {
            e.preventDefault();

            // Only process if definition is not already matched
            if (def.classList.contains('correct')) return;

            // Read the dragged key using dataTransfer
            const draggedKey = e.dataTransfer.getData('text/plain');

            // Find the word element that matches the dragged key
            const wordToMatch = Array.from(words).find(w => 
                w.dataset.match === draggedKey && 
                !w.classList.contains('matched')
            );

            if (!wordToMatch) return;

            // Compare draggedKey with definition.dataset.match
            const isCorrect = draggedKey === def.dataset.match;

            if (isCorrect) {
                // If correct: Add class "matched" to both elements
                wordToMatch.classList.add('matched');
                def.classList.add('correct');

                // Disable dragging on the matched word
                wordToMatch.setAttribute('draggable', 'false');

                // Display the word in the definition for visual confirmation
                const wordSpan = document.createElement('span');
                wordSpan.className = 'dropped-word';
                wordSpan.textContent = wordToMatch.textContent;
                def.insertBefore(wordSpan, def.firstChild);

                // Increment matched counter
                matchedCount++;

                // When matched counter equals total number of words
                if (matchedCount === totalWords) {
                    // Show "Great job!"
                    if (feedback) {
                        feedback.textContent = 'Great job!';
                        feedback.className = 'feedback-area show correct';
                    }
                    // Call markActivityComplete()
                    markActivityComplete(
                        feedback,
                        'Great job!',
                        'correct'
                    );
                } else if (feedback) {
                    feedback.textContent = 'Correct! Keep matching.';
                    feedback.className = 'feedback-area show correct';
                }
            } else {
                // If incorrect: Show "Try again." in .feedback-area
                if (feedback) {
                    feedback.textContent = 'Try again.';
                    feedback.className = 'feedback-area show incorrect';
                }
            }
        });
    });
}


// SLIDE 8 - Picture Walk
function initSlide8() {
    const page = document.querySelector('.page');
    if (!page) return;

    const input = page.querySelector('.one-sentence-input');
    const saveBtn = page.querySelector('.submit-btn');
    const feedback = page.querySelector('.feedback-area');

    const saved = localStorage.getItem('prediction');
    if (saved) input.value = saved;

    saveBtn.addEventListener('click', () => {
        const text = input.value.trim();

        // Validate: one sentence max
        if (!text) {
            if (feedback) {
                feedback.textContent = 'Please type your sentence before submitting.';
                feedback.className = 'feedback-area show incorrect';
            }
            return;
        }

        // Count sentence-ending punctuation marks
        const sentenceEndings = text.match(/[.!?]/g);
        const sentenceCount = sentenceEndings ? sentenceEndings.length : 1;

        if (sentenceCount > 1 || text.includes('\n')) {
            if (feedback) {
                feedback.textContent = 'Please write only one sentence.';
                feedback.className = 'feedback-area show incorrect';
            }
            return;
        }

        // Save to localStorage and mark activity complete
        localStorage.setItem('prediction', text);
        markActivityComplete(
            feedback,
            'Interesting idea!',
            'info'
        );
    });
}

// SLIDE 9 - Mystery Box
function initSlide9() {
    const page = document.querySelector('.page');
    if (!page) return;

    // Attach logic only when Mystery Box exists
    const toggle = page.querySelector('.mystery-box-toggle');
    const optionsWrap = page.querySelector('.mystery-options');
    const options = page.querySelectorAll('.mystery-choice');
    const feedback = page.querySelector('.feedback-area');
    const mysteryImg = page.querySelector('#mystery-box-image');

    if (!toggle || !optionsWrap || !options.length || !feedback) return;

    toggle.addEventListener('click', () => {
        optionsWrap.classList.remove('is-hidden');
        feedback.textContent = 'Pick one answer.';
        feedback.className = 'feedback-area show info';
    });

    options.forEach(btn => {
        btn.addEventListener('click', () => {
            options.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');

            const isCorrect = btn.hasAttribute('data-correct');
            if (isCorrect) {
                // Save answer and complete
                localStorage.setItem('mystery-box', 'baby rabbits');
                markActivityComplete(
                    feedback,
                    'Surprise! You found the babies.',
                    'correct'
                );
                if (mysteryImg) mysteryImg.classList.add('revealed');
            } else {
                feedback.textContent = 'Try again.';
                feedback.className = 'feedback-area show incorrect';
            }
        });
    });
}

// SLIDE 10 - Character Focus (Heart Meter)
function initSlide10() {
    const page = document.querySelector('.page');
    if (!page) return;

    // Attach only when heart meter exists
    const meter = page.querySelector('.heart-meter');
    if (!meter) return;

    const fill = page.querySelector('.heart-meter-fill');
    const meterText = page.querySelector('.heart-meter-text');
    const cards = page.querySelectorAll('.trait-card');
    const feedback = page.querySelector('.feedback-area');

    if (!fill || !meterText || !cards.length || !feedback) return;

    const selectedGood = new Set();
    const TOTAL_GOOD = 2; // Caring + Patient

    function renderMeter() {
        const value = selectedGood.size;
        const pct = Math.round((value / TOTAL_GOOD) * 100);
        fill.style.width = pct + '%';
        meterText.textContent = `Heart: ${value} / ${TOTAL_GOOD}`;
    }

    renderMeter();

    cards.forEach(card => {
        card.addEventListener('click', () => {
            const isGood = card.hasAttribute('data-good');
            const trait = card.dataset.trait;

            // Toggle selection style
            if (card.classList.contains('selected')) {
                card.classList.remove('selected');
                if (isGood) selectedGood.delete(trait);
                renderMeter();
                return;
            }

            card.classList.add('selected');

            if (isGood) {
                selectedGood.add(trait);
                renderMeter();

                if (selectedGood.size === TOTAL_GOOD) {
                    markActivityComplete(
                        feedback,
                        'Your heart is full of kind choices!',
                        'correct'
                    );
                } else {
                    feedback.textContent = 'Nice pick! Choose another kind trait.';
                    feedback.className = 'feedback-area show info';
                }
            } else {
                // Gentle feedback for wrong trait
                feedback.textContent = 'That might hurt someone’s feelings. Try a kinder trait.';
                feedback.className = 'feedback-area show incorrect';
            }
        });
    });
}

// SLIDE 11 - Cause and Effect (Dominoes)
function initSlide11() {
    const page = document.querySelector('.page');
    if (!page) return;

    const container = page.querySelector('.domino-container');
    if (!container) return;

    const causes = page.querySelectorAll('.domino-cause');
    const effects = page.querySelectorAll('.domino-effect');
    const feedback = page.querySelector('.feedback-area');

    if (!causes.length || !effects.length || !feedback) return;

    let draggedDomino = null;
    let matchedCount = 0;

    causes.forEach(cause => {
        cause.addEventListener('dragstart', (e) => {
            if (cause.classList.contains('matched')) {
                e.preventDefault();
                return;
            }
            draggedDomino = cause;
            cause.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });

        cause.addEventListener('dragend', () => {
            cause.classList.remove('dragging');
            // keep draggedDomino until drop handler clears it
        });
    });

    effects.forEach(effect => {
        effect.addEventListener('dragover', (e) => {
            if (effect.classList.contains('correct')) return;
            e.preventDefault();
            effect.classList.add('drag-over');
        });

        effect.addEventListener('dragleave', () => {
            effect.classList.remove('drag-over');
        });

        effect.addEventListener('drop', (e) => {
            e.preventDefault();
            effect.classList.remove('drag-over');

            if (!draggedDomino || effect.classList.contains('correct')) return;

            const isCorrect = draggedDomino.dataset.effect === effect.dataset.effect;

            if (isCorrect) {
                // Lock this pair
                draggedDomino.classList.add('matched', 'fallen');
                effect.classList.add('correct');
                matchedCount++;

                if (matchedCount === causes.length) {
                    markActivityComplete(
                        feedback,
                        'You made the dominoes fall!',
                        'correct'
                    );
                } else {
                    feedback.textContent = 'Nice match! Watch the domino fall, then match the next one.';
                    feedback.className = 'feedback-area show info';
                }
            } else {
                feedback.textContent = 'Try again. Think about what Pip would do next.';
                feedback.className = 'feedback-area show incorrect';
            }

            draggedDomino = null;
        });
    });
}

// SLIDE 12 - Big Moment (Spotlight)
function initSlide12() {
    const page = document.querySelector('.page');
    if (!page) return;

    const choices = page.querySelectorAll('.moment-choice');
    const feedback = page.querySelector('.feedback-area');
    const hiddenImage = page.querySelector('#hidden-moment-image');
    const questionMark = page.querySelector('#question-mark');

    if (!choices.length || !feedback) return;

    choices.forEach(choice => {
        choice.addEventListener('click', () => {
            // Clear prior states
            choices.forEach(c => c.classList.remove('selected', 'spotlight-on'));

            choice.classList.add('selected');

            const isCorrect = choice.hasAttribute('data-correct');
            if (isCorrect) {
                choice.classList.add('spotlight-on');
                markActivityComplete(
                    feedback,
                    'Correct answer!',
                    'correct'
                );
                if (hiddenImage) hiddenImage.classList.remove('hidden');
                if (questionMark) questionMark.classList.add('hidden');
            } else {
                feedback.textContent = 'Try again. Think about the biggest moment with Katya and Pip.';
                feedback.className = 'feedback-area show incorrect';
            }
        });
    });
}

// SLIDE 13 - Theme (Advice Board)
function initSlide13() {
    const page = document.querySelector('.page');
    if (!page) return;

    const adviceButtons = page.querySelectorAll('.advice-choice');
    const feedback = page.querySelector('.feedback-area');

    if (!adviceButtons.length || !feedback) return;

    adviceButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Clear pinned/selected states
            adviceButtons.forEach(b => b.classList.remove('selected', 'pinned'));

            btn.classList.add('selected');

            const isCorrect = btn.hasAttribute('data-correct');
            if (isCorrect) {
                btn.classList.add('pinned');
                markActivityComplete(
                    feedback,
                    'Advice pinned! This story reminds us to be patient with others.',
                    'correct'
                );
            } else {
                feedback.textContent = 'Try again. Which advice feels most caring and patient?';
                feedback.className = 'feedback-area show incorrect';
            }
        });
    });
}

// SLIDE 14 - Story Strip (Beginning / Middle / End)
function initSlide14() {
    const page = document.querySelector('.page');
    if (!page) return;

    const inputs = page.querySelectorAll('.story-strip-input');
    const submitBtn = page.querySelector('.story-strip-submit');
    const feedback = page.querySelector('.feedback-area');

    if (!inputs.length || !submitBtn || !feedback) return;

    // Load any saved sentences (optional)
    const keys = ['beginning', 'middle', 'end'];
    inputs.forEach((input, index) => {
        const saved = localStorage.getItem(`story-strip-${keys[index]}`);
        if (saved) input.value = saved;
    });

    submitBtn.addEventListener('click', () => {
        // Validate: one short sentence in each panel
        for (let i = 0; i < inputs.length; i++) {
            const text = inputs[i].value.trim();
            if (!text) {
                feedback.textContent = 'Please write one short sentence in each panel.';
                feedback.className = 'feedback-area show incorrect';
                return;
            }
            const sentenceEndings = text.match(/[.!?]/g);
            const sentenceCount = sentenceEndings ? sentenceEndings.length : 1;
            if (sentenceCount > 1 || text.includes('\\n')) {
                feedback.textContent = 'Keep each panel to just one sentence.';
                feedback.className = 'feedback-area show incorrect';
                return;
            }
        }

        // Save sentences
        inputs.forEach((input, index) => {
            localStorage.setItem(`story-strip-${keys[index]}`, input.value.trim());
        });

        markActivityComplete(
            feedback,
            'You told the story!',
            'correct'
        );
    });
}

// SLIDE 15 - Completion message only
function initSlide15() {
    const page = document.querySelector('.page');
    if (!page) return;

    // Mark complete so Next is available
    activityCompleted = true;
    completedSlides.add(14);
    saveProgress();
    updateUI();

    // Wire "See Your Reward" button to go to slide16
    const rewardBtn = page.querySelector('.finish-reward-btn');
    if (rewardBtn) {
        rewardBtn.addEventListener('click', () => {
            loadSlide(15, 'next'); // slide16 (zero-indexed)
        });
    }
}

// SLIDE 16 - Winning Moment, badge, restart
function initSlide16() {
    const page = document.querySelector('.page');
    if (!page) return;

    const restartBtn = page.querySelector('.restart-story-btn');
    const feedback = page.querySelector('.feedback-area');

    // Play winning sound once when slide loads
    playWinSound();

    if (!restartBtn) return;

    restartBtn.addEventListener('click', () => {
        // Clear all progress from localStorage
        localStorage.removeItem('ebook-progress');
        
        // Clear other activity-specific localStorage items
        localStorage.removeItem('prediction');
        localStorage.removeItem('kwl-know');
        localStorage.removeItem('kwl-want');
        localStorage.removeItem('mystery-box');
        localStorage.removeItem('story-strip-beginning');
        localStorage.removeItem('story-strip-middle');
        localStorage.removeItem('story-strip-end');
        
        // Reset app state
        currentSlide = 0;
        activityCompleted = false;
        completedSlides.clear();
        
        // Save cleared progress
        saveProgress();
        
        // Load slide 1
        loadSlide(0);
    });
}

// Initialize slide interactions for current index
function initSlideForIndex(i) {
    switch (i) {
      case 0: initSlide1(); break;
      case 1: initSlide2(); break;
      case 2: initSlide3(); break;
      case 3: initSlide4(); break;
      case 4: initSlide5(); break;
      case 5: initSlide6(); break;
      case 6: initSlide7(); break;
      case 7: initSlide8(); break;
      case 8: initSlide9(); break;
      case 9: initSlide10(); break;
      case 10: initSlide11(); break;
      case 11: initSlide12(); break;
      case 12: initSlide13(); break;
      case 13: initSlide14(); break;
      case 14: initSlide15(); break;
      case 15: initSlide16(); break;
    }
  }