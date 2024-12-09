# Kemono Creator Filter

This is a fork of the `Kemono.Party - User Filter` userscript provided on [Sleazy Fork](https://sleazyfork.org/en/scripts/471723-kemono-party-user-filter). Credits to [天音](https://sleazyfork.org/en/users/164321-%E5%A4%A9%E9%9F%B3) for developing the original userscript.

Due to Kemono switching it's frontend to React, the original userscript no longer works. This version (as hacky as it is) should work with React router/SPA.

Blocked creators are stored in the userscript's value storage under the `blacklists` key. Violentmonkey and Tampermonkey allow you to view and edit this should you wish to import existing lists.

## Installation

Assuming you've got a userscript manager like Violentmonkey or Tampermonkey, simply visit https://github.com/komoreshi/kemono-creator-filter/raw/refs/heads/main/kemono_creator_filter.user.js and follow the prompt to install.

## Blacklist format

When a creator is blocked, the value is stored in the format `service`_`user`. For example: `fanbox_00000000`, `patreon_00000000`, `gumroad_0000000000000`, etc.
