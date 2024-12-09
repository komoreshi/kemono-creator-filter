// ==UserScript==
// @name         Kemono - Creator Filter
// @description  Block specified creators in artists page and posts page.
// @version      1.16
// @match        https://*.kemono.su/*
// @match        https://kemono.su/*
// @grant        GM_setValue
// @grant        GM_getValue
// @license      MIT
// @run-at       document-start
// @esversion    11
// ==/UserScript==

let blacklists = GM_getValue('blacklists', []);
let filter_enabled = GM_getValue('filter_enabled', true);
let is_user_page = false;
let is_posts_page = false;
let is_artists_page = false;

// debug helper stays because this was hell
function debugLog(msg, data) {
    console.log(`[Creator Filter] ${msg}`, data || '');
}


// burn in hell for this sloppy work-around react
function updatePageState() {
    const path = location.pathname;
    is_user_page = path.indexOf('/user/') >= 0;
    is_posts_page = path.indexOf('/posts') === 0;
    is_artists_page = path.indexOf('/artists') === 0;
}

function shouldInitialize() {
    const path = location.pathname;
    return path.startsWith('/posts') ||
           path.startsWith('/artists') ||
           path.includes('/user/');
}

// main init
function initializeScript() {
    debugLog('Initializing script');
    updatePageState();

    if (!shouldInitialize()) {
        debugLog('Not a relevant page, skipping initialization');
        return;
    }

    blacklists = GM_getValue('blacklists', []);
    filter_enabled = GM_getValue('filter_enabled', true);

    // ensure styles are added
    if (!document.querySelector('#kemono-filter-style')) {
        addStyle();
    }

    // wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setupObservers();
            processExistingElements();
        });
    } else {
        setupObservers();
        processExistingElements();
    }
}

function setupObservers() {
    setupPageObserver();
    setupCardObserver();
}

function processExistingElements() {
    const ptop = document.querySelector('#paginator-top');
    if (ptop) {
        const menu = ptop.querySelector('menu');
        if (menu && !menu.querySelector('.filter-switch')) {
            addFilterButtonTo(menu);
        }
    }

    if (is_posts_page) {
        document.querySelectorAll('article.post-card').forEach(card => {
            if (!card.querySelector('.btn-block')) {
                addBlockButtonTo(card);
            }
        });
    }

    if (is_artists_page) {
        document.querySelectorAll('a.user-card').forEach(card => {
            if (!card.querySelector('.btn-block')) {
                addBlockButtonTo(card);
            }
        });
    }

    if (is_user_page) {
        addBlockButtonToUserPage();
    }
}

function setupPageObserver() {
    debugLog('Setting up page observer');
    const bodyObserver = new MutationObserver((mutations) => {
        const ptop = document.querySelector('#paginator-top');
        if (ptop) {
            const menu = ptop.querySelector('menu');
            if (menu && !menu.querySelector('.filter-switch')) {
                addFilterButtonTo(menu);
            }
        }

        if (is_user_page) {
            addBlockButtonToUserPage();
        }
    });

    bodyObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
}

function setupCardObserver() {
    debugLog('Setting up card observer');
    // main container observer
    const observer = new MutationObserver((mutations) => {
        if (is_posts_page) {
            document.querySelectorAll('article.post-card').forEach(card => {
                if (!card.querySelector('.btn-block')) {
                    debugLog('Adding block button to post card', card);
                    addBlockButtonTo(card);
                }
            });
        }

        if (is_artists_page) {
            document.querySelectorAll('a.user-card').forEach(card => {
                if (!card.querySelector('.btn-block')) {
                    debugLog('Adding block button to artist card', card);
                    addBlockButtonTo(card);
                }
            });
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
    });
}

function addFilterButtonTo(menu) {
    if (!menu || menu.querySelector('.filter-switch')) return;

    let btn_switch = document.createElement('a');
    btn_switch.classList.add('filter-switch');
    btn_switch.innerHTML = '<b>Filter</b>';
    if (filter_enabled) menu.closest('section')?.classList.add('filter-enabled');
    else btn_switch.classList.add('pagination-button-disabled');
    menu.insertBefore(btn_switch, menu.firstChild);
    btn_switch.onclick = () => {
        filter_enabled = !filter_enabled;
        menu.closest('section')?.classList.toggle('filter-enabled');
        btn_switch.classList.toggle('pagination-button-disabled');
        GM_setValue('filter_enabled', filter_enabled);
    };
}

function addBlockButtonTo(card) {
    debugLog('Adding block button to card', card);
    let service, user;

    if (card.classList.contains('post-card')) {
        service = card.dataset.service || card.querySelector('a')?.getAttribute('href')?.split('/')[1];
        user = card.dataset.user || card.querySelector('a')?.getAttribute('href')?.split('/')[3];
    } else if (card.classList.contains('user-card')) {
        const href = card.getAttribute('href');
        service = href?.split('/')[1];
        user = href?.split('/')[3];
    }

    if (!service || !user) {
        debugLog('Could not extract service or user from card', { service, user });
        return;
    }

    let is_blocked = blacklists.indexOf(service + '_' + user) >= 0;
    if (is_blocked) card.dataset.blocked = true;

    let btn_block = document.createElement('label');
    btn_block.classList.add('btn-block');
    btn_block.innerHTML = `<b></b>`;

    const footer = card.querySelector('footer') || card;
    footer.appendChild(btn_block);

    btn_block.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        updateCards(service, user, card.dataset.blocked, is_artists_page && card);
        blockUser(service, user);
    };

    if (is_posts_page) {
        btn_block.onmouseover = () => hintUser(service, user, card.dataset.blocked, true);
        btn_block.onmouseout = () => hintUser(service, user);
    }
}

function addBlockButtonToUserPage() {
    // don't add button if it already exists
    if (document.querySelector('.btn-block-user')) {
        debugLog('Block button already exists, skipping');
        return;
    }

    debugLog('Starting to add block button to user page');

    const actionSelectors = [
        '.artist-links',              // try the artist links container
        '.user-header .links',        // common pattern for header links
        '.user-header__actions',      // original selector
        '.artist-actions',            // another possible container
        '.user-links'                 // generic links container
    ];
    let actionsContainer;

    debugLog('Starting search for actions container');

    for (const selector of actionSelectors) {
        actionsContainer = document.querySelector(selector);
        if (actionsContainer) {
            debugLog('Found container using selector', {
                selector: selector,
                element: actionsContainer,
                classes: actionsContainer.className,
                html: actionsContainer.outerHTML
            });
            break;
        } else {
            debugLog('Selector not found', selector);
        }
    }

    // try header link fallback
    if (!actionsContainer) {
        debugLog('No container found with primary selectors, trying header link fallback');
        const headerLink = document.querySelector('.user-header a, .artist-header a');
        if (headerLink) {
            actionsContainer = headerLink.parentElement;
            debugLog('Found container via header link parent', {
                parentElement: actionsContainer,
                classes: actionsContainer.className,
                html: actionsContainer.outerHTML
            });
        } else {
            debugLog('No header link found for fallback');
        }
    }

    // try again
    if (!actionsContainer) {
        debugLog('No container found via link, trying header fallback');
        const header = document.querySelector('.user-header, .artist-header');
        if (header) {
            actionsContainer = document.createElement('div');
            actionsContainer.classList.add('artist-links');
            header.appendChild(actionsContainer);
            debugLog('Created new container in header', {
                header: header,
                newContainer: actionsContainer,
                html: actionsContainer.outerHTML
            });
        } else {
            debugLog('No header found for final fallback');
        }
    }

    if (!actionsContainer) {
        debugLog('Could not find or create actions container');
        return;
    }

    let [service, user] = location.pathname.slice(1).split('/user/');
    if (!service || !user) {
        debugLog('Could not extract service or user from URL', { service, user });
        return;
    }

    let is_blocked = blacklists.indexOf(service + '_' + user) >= 0;
    updateCards(service, user, !is_blocked);

    let btn_block = document.createElement('a');
    btn_block.classList.add('btn-block-user');
    btn_block.classList.add('user-header__action');
    btn_block.classList.add('artist-link');
    if (is_blocked) btn_block.classList.add('blocked');

    // insert at the end of the actions container
    actionsContainer.appendChild(btn_block);
    debugLog('Block button added successfully', {
        button: btn_block,
        container: actionsContainer
    });

    btn_block.onclick = () => {
        btn_block.classList.toggle('blocked');
        updateCards(service, user, is_blocked);
        blockUser(service, user, is_blocked);
        is_blocked = !is_blocked;
    };
}

function blockUser(service, user, is_blocked) {
    let user_id = service + '_' + user;
    if (is_blocked) {
        blacklists = blacklists.filter(id => id !== user_id);
    } else {
        blacklists.push(user_id);
    }
    GM_setValue('blacklists', blacklists);
}

function updateCards(service, user, is_blocked, user_card) {
    if (user_card) updateCard(user_card, is_blocked);
    else {
        let post_cards = document.querySelectorAll(`article.post-card[data-service="${service}"][data-user="${user}"]`);
        post_cards.forEach(post_card => updateCard(post_card, is_blocked));
    }
}

function updateCard(card, is_blocked) {
    if (is_blocked) card.removeAttribute('data-blocked');
    else card.setAttribute('data-blocked', true);
}

function hintUser(service, user, is_blocked, onmouseover) {
    let post_cards = document.querySelectorAll(`article.post-card[data-service="${service}"][data-user="${user}"]`);
    post_cards.forEach(post_card => {
        if (onmouseover) {
            post_card.setAttribute(is_blocked ? 'data-hint-unblock' : 'data-hint-block', true);
        } else {
            post_card.removeAttribute('data-hint-block');
            post_card.removeAttribute('data-hint-unblock');
        }
    });
}

function addStyle() {
    // wait for head element to exist
    if (!document.head) {
        setTimeout(addStyle, 10);
        return;
    }

    let css = `
    menu > a.filter-switch {color: orange;}
    .filter-enabled [data-blocked] {display: none;}
    /* card glow */
    .user-card, .post-card > a {transition: box-shadow .25s ease, opacity .25s ease;}
    .user-card[data-blocked], .post-card[data-blocked] > a {opacity: 0.75; box-shadow: 0 0 4px 2px orangered;}
    .post-card[data-hint-block] > a {opacity: 1; box-shadow: 0 0 4px 2px orange;}
    .post-card[data-hint-unblock][data-blocked] > a {opacity: 1; box-shadow: 0 0 4px 2px yellowgreen;}
    /* block button */
    :not([data-blocked]) .btn-block:not(:hover) b {visibility: hidden;}
    .btn-block {padding: 10px; position: absolute; right: -5px; bottom: -5px; z-index: 1000; cursor: pointer;}
    .btn-block > b {color: white; background-color: orangered; border: 1px solid black; border-radius: 4px; padding: 0 4px;}
    .btn-block > b::before {content: 'Block User'}
    [data-blocked] .btn-block > b::before {content: 'Blocked';}
    [data-blocked] .btn-block:hover > b {background-color: yellowgreen;}
    [data-blocked] .btn-block:hover > b::before {content: 'Unblock';}
    /* block button (user page) */
    .btn-block-user {
        display: inline-flex;
        align-items: center;
        color: grey;
        cursor: pointer;
        text-decoration: none;
        margin-left: 0.5rem;
    }
    .btn-block-user::before {
        content: 'Block';
        display: inline-block;
    }
    .btn-block-user.blocked {
        color: orangered;
    }
    .btn-block-user.blocked::before {
        content: 'Blocked';
    }
    /* Style to match other artist links */
    .btn-block-user.artist-link {
        margin: 0 0.5rem;
    }
    /* UI fix for AutoPagerize */
    .autopagerize_page_separator, .autopagerize_page_info {flex: unset; width: 100%;}
    `;

    // check if style already exists to prevent duplicates
    if (!document.querySelector('#kemono-filter-style')) {
        const style = document.createElement('style');
        style.id = 'kemono-filter-style';
        style.textContent = css;
        document.head.appendChild(style);
    }
}

// SPA navigation handling
function setupNavigationHandling() {
    if (typeof window.navigation !== 'undefined') {
        // 'modern' navigation API
        navigation.addEventListener('navigate', (event) => {
            if (event.destination.url !== location.href) {
                debugLog('Navigation detected via Navigation API');
                // small delay to ensure DOM is updated
                setTimeout(initializeScript, 50);
            }
        });
    }

    // fallback history state observer
    let lastUrl = location.href;
    function checkForUrlChange() {
        const currentUrl = location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            debugLog('URL changed via history state');
            setTimeout(initializeScript, 50);
        }
    }

    window.addEventListener('popstate', checkForUrlChange);

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function() {
        originalPushState.apply(this, arguments);
        checkForUrlChange();
    };

    history.replaceState = function() {
        originalReplaceState.apply(this, arguments);
        checkForUrlChange();
    };
}

// les go
setupNavigationHandling();
initializeScript();
