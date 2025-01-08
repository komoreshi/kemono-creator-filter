# Kemono Creator Filter

This is a fork of the `Kemono.Party - User Filter` userscript provided on [Sleazy Fork](https://sleazyfork.org/en/scripts/471723-kemono-party-user-filter) with some additional functionality added, namely the ability to create and add to more than a single blacklist. Credits to [天音](https://sleazyfork.org/en/users/164321-%E5%A4%A9%E9%9F%B3) for developing the original userscript.

Due to Kemono switching it's frontend to React, the original userscript no longer works. This version (as hacky as it is) should work with the recent changes.

## Installation

Assuming you've got a userscript manager like Violentmonkey or Tampermonkey, simply visit https://github.com/komoreshi/kemono-creator-filter/raw/refs/heads/main/kemono_creator_filter.user.js and follow the prompt to install.

## Blacklist format

When a creator is blocked, the value is stored in the format `service`_`user`. For example: `fanbox_00000000`, `patreon_00000000`, `gumroad_0000000000000`, etc. An example of what the value storage looks like:

```
{
  "Default": [],
  "AI": [
    "patreon_95422950",
    "patreon_97246225",
    "patreon_127673906",
    "patreon_104932423",
    "patreon_124443150",
    "patreon_94053285",
    "patreon_133351242"
  ],
  "Influencers": [
    "patreon_136004948",
    "patreon_72457919"
  ],
  "Reactions": [
    "patreon_30820557"
  ]
}
```

## To-do
 - Better handle adding accounts to more than one list. Currently, this is only achievable via manually editing the value storage keys.
