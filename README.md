# Next PR Number

Next PR Number is a web tool that allows you to quickly and easily know what number
your PR will be assigned before opening it. Forget guessing the number or checking
afterhand.

**Features:**

- **Sharable URLs that autofill the repository** - Want your project's contributors to
  use Next PR Number? Give them a link that autofills and queries your repository for
  them for a seamless experience. [Here's an example.][example]
- **Lightweight** - Next PR Number is built with pure HTML, JS, CSS. There's no
  dependencies that slow down page load (except for analytics provided by [microanalytics.io])

In all seriousness, this exists to make changelog entry enforcement easier
and a smoother experience for everyone. I help maintain [Black] and [bandersnatch].
Writing a changelog in preparation for a release takes time, time that could be better
spent on other things. So a policy was introduced where (substantial) PRs must have an
changelog entry containing the PR number. While that reduced the administrative workload,
it merely pushed the workload onto the contributors, who must now get the PR number
somehow.

You can guess / fill-in the rest of the details :)

**Note: Next PR Number only supports public GitHub repositories**

## Privacy statement

Next PR Number to subject to the [privacy statement on my personal website][privacy].

## Self-hosting / forking

> Next PR Number is licensed under [MIT](./LICENSE.txt).

The source contains analytics code that interact with [microanalytics.io]. If you do host
your own version of Next PR Number or otherwise fork it, you will probably want to remove
this code in `index.html`:

```html
<script data-host="https://microanalytics.io" data-dnt="true" src="https://microanalytics.io/js/script.js" id="ZwSg9rf6GA" async="" defer=""></script>
```

Also, don't forget to change copyright and branding :)

## Contributing

Contributions of all sorts are welcomed, even feedback if it's constructive! Opening
an issue to check with me before working on a changeset is highly recommended.

In terms of technical tips, I recommend that you use Python's built-in webserver to test
locally while iterating on your changes:

```console
example-user@example-desktop:~$ cd next-pr-number
example-user@example-desktop:~/next-pr-number$ python -m http.server 4000
Serving HTTP on 0.0.0.0 port 4000 (http://0.0.0.0:4000/) ...
```

Please note that this project to also my excuse to learn web development. So I'm sure
I'm doing a ton of things wrong in this project :) I'm open to feedback in this regard
too.

Finally, don't forget to add yourself to the AUTHORS list below. You made a contribution
and you deserve the thanks!

### SQLite3 Schema

```sql
CREATE TABLE "queries" (
    "datetime"   TEXT PRIMARY KEY NOT NULL,
    "owner"      TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "result"     INTEGER NOT NULL
);

CREATE TABLE "requests" (
    "datetime"   TEXT PRIMARY KEY NOT NULL,
    "ip"         TEXT,
    "useragent"  TEXT,
    "verb"       TEXT NOT NULL,
    "path"       TEXT NOT NULL,
    "status"     INTEGER NOT NULL,
    "duration"   REAL NOT NULL
);

CREATE TABLE "ratelimits" (
    "key"       TEXT NOT NULL,
    "duration"  INTEGER NOT NULL,
    "value"     INTEGER NOT NULL,
    "expiry"    TEXT NOT NULL,
    PRIMARY KEY("key", "expiry")
);
```

## Authors

Glued together by Richard Si ([@ichard26](https://github.com/ichard26)).

- Jaap Roes
- Marc Mueller ([@cdce8p](https://github.com/cdce8p))
- *your name here perhaps?*

[bandersnatch]: https://github.com/pypa/bandersnatch
[black]: https://github.com/psf/black
[example]: https://ichard26.github.io/next-pr-number/?owner=psf&name=black
[microanalytics.io]: https://microanalytics.io/
[privacy]: https://ichard26.github.io/privacy/
