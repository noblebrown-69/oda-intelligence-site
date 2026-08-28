# Oda Intelligence — site + members chat

![Oda Intelligence](screenshot.png)

A local private app, shown on the public web. WordPress is the front door. The [Hermes](https://github.com/NousResearch/hermes-agent) agent host phones home. The website never reaches it.

Live: [odaintelligence.com](https://odaintelligence.com)

## What a visitor sees

`/` and `/stack/` are public. `/chat/` is members only. Registration is off; accounts are by invite. A Subscriber signs in, types to Oda, and waits about a minute. That wait is the product, not a bug.

Copy on the chat page:

- Logged out: *Members only. Sign in to talk to Oda. Accounts are by invite.*
- Logged in: *Replies take a minute. This is not a live wire.*

No security sticker. Guardrails live in the poller and a tool-less Hermes profile, not in the brochure.

## How it actually talks

Not an iframe. Not Open WebUI. Not a live WebSocket to the model. The browser talks only to WordPress REST on the same site. A oneshot poller on the agent host pulls the inbox and posts replies.

```
browser
  -> WordPress (theme + [oda_chat] shortcode)
       per-user thread in wp_oda_chat_messages
       REST /wp-json/oda-chat/v1/
            /message  /thread   = logged-in member
            /inbox    /reply    = poller capability only
       optional wp_mail to a siloed mailbox

agent host
  poller (~60s)
    IMAP on that mailbox (password never stored in WordPress)
    GET inbox / POST reply
    Hermes profile webdemo — Oda voice, no tools
    local sqlite archive, one thread per WordPress user
```

One login is one thread. `GET /thread` is hardcoded to the current user. Refresh keeps that member's buffer. Other members see a blank room of their own.

Visitor text is data, not orders. The poller fences it before it reaches the model. Replies take about a minute.

This repo is not the fitness logger. That is a separate tree.

## Tokens

```
--bg:      #070708
--gold:    #c9a227
--crimson: #9a1c1c
--ink:     #e8e4dc
type:      Cormorant Garamond + DM Sans
```

Same brand as Oda Fit. Not a chatbot skin.

## Layout

```
theme/oda-intelligence/     WordPress theme 1.0.3
plugin/oda-members-chat/    Members chat 1.0.1
aegis/                      Poller, archive helper, systemd units, env.example
```

`page.php` is required. Without it, `/chat/` renders *Nothing here.*

## WordPress

Zip the theme folder and replace the live theme. Zip the plugin folder and replace the live plugin. The Theme File Editor is blocked on the host — do not edit PHP in the dashboard.

Set the notify mailbox with the `oda_chat_notify_email` option (or the `oda_chat_notify_email` filter). Leave it empty and the REST queue still works; the poller can pull `/inbox` without mail.

Humans are Subscribers. The poller is a dedicated user with the `oda_poller` role (`oda_chat_poll` only). Registration stays off.

No X / Twitter links.

## Agent host

Copy `aegis/oda-guestchat-poller.py` and `aegis/oda_chatlog.py` next to each other (the poller imports the archive helper). Point the user unit at the poller. Enable the timer.

Put secrets in `~/.hermes/secrets/` as `guestchat.env` and `guestchat-wp.env`. Names only are in `aegis/env.example`. Mode 0600. Never commit those files. Production digest mail is a different mailbox — do not reuse it here.

The `webdemo` profile has no tools. Do not give it the production Oda SOUL's privileges. Do not write the executive memory bank.

## REST

| | who | body |
|---|---|---|
| `POST /wp-json/oda-chat/v1/message` | member | `{ "text" }` |
| `GET /wp-json/oda-chat/v1/thread` | member | own rows only |
| `GET /wp-json/oda-chat/v1/inbox?status=pending` | poller | |
| `POST /wp-json/oda-chat/v1/reply` | poller | `{ "id", "text" }` |

Rate: 8 user messages / 10 minutes. Max 2000 characters.

## Out of scope

Fitness logger, production Oda SOUL, llama, Open WebUI, mailbox passwords.

## License

Source is here so other Hermes people can run the same idea: a public face that cannot see the box, and a box that pulls the queue. Keep your accounts and your IPs off the internet.
