// ==UserScript==
// @name         Kemono - Creator Filter
// @description  Block specified creators on artists and posts pages.
// @version      1.20
// @match        https://*.kemono.su/*
// @match        https://kemono.su/*
// @grant        GM_setValue
// @grant        GM_getValue
// @license      MIT
// @run-at       document-start
// @esversion    11
// ==/UserScript==

let blacklists = GM_getValue('blacklists', {});
let filter_enabled = GM_getValue('filter_enabled', true);
let is_user_page = false;
let is_posts_page = false;
let is_artists_page = false;
const DEFAULT_LIST_NAME = 'Default';

function debugLog(msg, data) {
    console.log(`[Creator Filter] ${msg}`, data || '');
}

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

function initializeScript() {
    debugLog('Initializing script');
    updatePageState();

    if (!shouldInitialize()) {
        debugLog('Not a relevant page, skipping initialization');
        return;
    }

    blacklists = GM_getValue('blacklists', {});

  // initialize default list if it doesn't exist
   if (!blacklists[DEFAULT_LIST_NAME]) {
        blacklists[DEFAULT_LIST_NAME] = [];
    }
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
                    // debugLog('Adding block button to post card', card);
                    addBlockButtonTo(card);
                }
            });
        }

        if (is_artists_page) {
            document.querySelectorAll('a.user-card').forEach(card => {
                if (!card.querySelector('.btn-block')) {
                    // debugLog('Adding block button to artist card', card);
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
        console.log("Filter button clicked!");
        filter_enabled = !filter_enabled;
        menu.closest('section')?.classList.toggle('filter-enabled');
        btn_switch.classList.toggle('pagination-button-disabled');
        GM_setValue('filter_enabled', filter_enabled);
    };
}

function addBlockButtonTo(card) {
    // debugLog('Adding block button to card', card);
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

    const userId = service + '_' + user;
    let is_blocked = Object.values(blacklists).some(list => list.includes(userId));
    if (is_blocked) card.dataset.blocked = true;

    let btn_block = document.createElement('label');
    btn_block.classList.add('btn-block');
    btn_block.innerHTML = `<b></b>`;

    const footer = card.querySelector('footer') || card;
    footer.appendChild(btn_block);

    btn_block.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        const currentIsBlocked = Object.values(blacklists).some(list => list.includes(userId));
        showBlockDialog(service, user, card, currentIsBlocked, is_artists_page);
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

    const actionsContainer = document.querySelector('.user-header__actions');


    if (!actionsContainer) {
      debugLog('Could not find .user-header__actions container');
      return;
    }


    let [service, user] = location.pathname.slice(1).split('/user/');
    if (!service || !user) {
        debugLog('Could not extract service or user from URL', { service, user });
        return;
    }

    const userId = service + '_' + user;
    let is_blocked = Object.values(blacklists).some(list => list.includes(userId));


    let btn_block = document.createElement('a');
    btn_block.classList.add('btn-block-user');
    btn_block.classList.add('user-header__action');
    btn_block.classList.add('artist-link');
    if (is_blocked) btn_block.classList.add('blocked');

    // insert at the end of the actions container
    actionsContainer.appendChild(btn_block);

   btn_block.onclick = () => {
       // recalculate is_blocked here
       const is_blocked_on_click = Object.values(blacklists).some(list => list.includes(userId));
       showBlockDialog(service, user, btn_block, is_blocked_on_click);
   };
}

function updateCards(service, user, is_blocked) {
    debugLog('Updating cards', { service, user, is_blocked });

    // update post cards
    const post_cards = document.querySelectorAll(`article.post-card[data-service="${service}"][data-user="${user}"]`);
    post_cards.forEach(card => {
        if (is_blocked) {
            card.removeAttribute('data-blocked');
        } else {
            card.setAttribute('data-blocked', 'true');
        }
        debugLog('Updated post card', { card, is_blocked });
    });

    // update user cards
    const user_cards = document.querySelectorAll(`a.user-card[href*="/${service}/user/${user}"]`);
    user_cards.forEach(card => {
        if (is_blocked) {
            card.removeAttribute('data-blocked');
        } else {
            card.setAttribute('data-blocked', 'true');
        }
        debugLog('Updated user card', { card, is_blocked });
    });

    // update block buttons
    const blockButtons = document.querySelectorAll('.btn-block-user');
    blockButtons.forEach(btn => {
        btn.classList.toggle('blocked', !is_blocked);
        debugLog('Updated block button', { btn, is_blocked });
    });
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

function showBlockDialog(service, user, element, isBlocked, is_artists_page) {
    const userId = service + '_' + user;
    debugLog('Opening block dialog', { userId, isBlocked });

    const dialog = document.createElement('div');
    dialog.classList.add('block-dialog');

    dialog.innerHTML = `
        <div class="block-dialog-content">
            <h2>${isBlocked ? 'Unblock' : 'Block'} User</h2>
            <p>Select lists to ${isBlocked ? 'remove from' : 'add to'}:</p>
            <div class="block-dialog-lists"></div>
            ${isBlocked ? '' : '<input type="text" class="new-list-input" placeholder="New list name"><button class="create-list-btn">Create New List</button>'}
            <div class="block-dialog-actions">
                <button class="confirm-btn">${isBlocked ? 'Unblock' : 'Block'}</button>
                <button class="cancel-btn">Cancel</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    const listsContainer = dialog.querySelector('.block-dialog-lists');
    const confirmButton = dialog.querySelector('.confirm-btn');
    const cancelButton = dialog.querySelector('.cancel-btn');

    const newListInput = dialog.querySelector('.new-list-input');
    const createListBtn = dialog.querySelector('.create-list-btn');


    // show only lists that contain the userId when unblocking
    for (const listName in blacklists) {
        if (blacklists.hasOwnProperty(listName)) {
            if (isBlocked && !blacklists[listName].includes(userId)) {
                continue;
            }

            const listDiv = document.createElement('div');
            listDiv.classList.add('list-item');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `list-${listName}`;
            checkbox.checked = blacklists[listName].includes(userId);
            const label = document.createElement('label');
            label.textContent = listName;
            label.setAttribute('for', `list-${listName}`);
            listDiv.appendChild(checkbox);
            listDiv.appendChild(label);
            listsContainer.appendChild(listDiv);
        }
    }

    if (createListBtn) {
        createListBtn.onclick = () => {
           const newListName = newListInput.value.trim();
             if (newListName) {
                 if (!blacklists[newListName]) {
                   blacklists[newListName] = [];
                   const listDiv = document.createElement('div');
                   listDiv.classList.add('list-item');
                   const checkbox = document.createElement('input');
                   checkbox.type = 'checkbox';
                   checkbox.id = `list-${newListName}`;
                   checkbox.checked = true;
                   const label = document.createElement('label');
                   label.textContent = newListName;
                   label.setAttribute('for', `list-${newListName}`);
                   listDiv.appendChild(checkbox);
                   listDiv.appendChild(label);
                   listsContainer.appendChild(listDiv);

                   newListInput.value = "";

                 } else {
                    alert("List with this name already exists");
                 }
            }
         }
    }

    confirmButton.onclick = () => {
        debugLog('Confirm button clicked', { isBlocked });

        if (isBlocked) {
            for (const listName in blacklists) {
                if (blacklists[listName].includes(userId)) {
                    blacklists[listName] = blacklists[listName].filter(id => id !== userId);
                    debugLog(`Removed ${userId} from ${listName}`);

                    // clean up empty non-default lists
                    if (blacklists[listName].length === 0 && listName !== DEFAULT_LIST_NAME) {
                        delete blacklists[listName];
                        debugLog(`Deleted empty list ${listName}`);
                    }
                }
            }
        } else {
            const selectedLists = Array.from(listsContainer.querySelectorAll('input[type="checkbox"]:checked'))
                .map(checkbox => checkbox.id.replace('list-', ''));

            for (const listName of selectedLists) {
                if (!blacklists[listName]) {
                    blacklists[listName] = [];
                }
                if (!blacklists[listName].includes(userId)) {
                    blacklists[listName].push(userId);
                    debugLog(`Added ${userId} to ${listName}`);
                }
            }
        }

        GM_setValue('blacklists', blacklists);
        debugLog('Updated blacklists', blacklists);

        updateCards(service, user, isBlocked);

        dialog.remove();
    };

    cancelButton.onclick = () => {
        dialog.remove();
    };
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
    menu > a.filter-switch.pagination-button-disabled {
            pointer-events: auto !important; /* override Kemono's style */
            cursor: pointer; /* it's a button, so set the cursor */
    }
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
    /* Block dialog styles */
   .block-dialog {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.75);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    }

    .block-dialog-content {
        background-color: #333;
        color: #fff;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
        max-width: 400px;
        text-align: center;
    }

    .block-dialog-lists {
        max-height: 200px;
        overflow-y: auto;
        margin-bottom: 10px;
        text-align: left;
        padding: 0 20px
    }

    .list-item {
        margin: 5px 0;
        display: flex;
        align-items: center;
    }
    .list-item > input {
       margin-right: 5px;
    }
    .list-item > label {
        color: #fff;
    }

    .block-dialog-actions {
       margin-top: 15px;
       display: flex;
       justify-content: center;
       gap: 10px;
    }

    .block-dialog-actions button {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }

    .block-dialog-actions .confirm-btn {
        background-color: #4caf50;
        color: white;
    }

    .block-dialog-actions .cancel-btn {
        background-color: #f44336;
        color: white;
    }

    .new-list-input {
        margin: 10px auto;
        padding: 10px;
        border: 1px solid #ccc;
        border-radius: 4px;
        display: block;
        background-color: #444;
        color: #fff;
      }
   .create-list-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        background-color: #008CBA;
        color: white;
        display: block;
        margin: 0 auto;
    }

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

setupNavigationHandling();
initializeScript();
