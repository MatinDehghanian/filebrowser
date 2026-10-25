# مقایسهٔ فورک با File Browser اصلی

تاریخ بررسی: 2026-10-26

این گزارش وضعیت پیش از پیاده‌سازی تغییرات را ثبت می‌کند. نتیجهٔ اصلاحات و امکانات اضافه‌شده در [گزارش پیاده‌سازی](improvements-2026-10-26.md) آمده است.

## محدوده و نتیجه

- فورک محلی و شاخهٔ آنلاین `MatinDehghanian/filebrowser:master`: `f3a18b10a7e14ddc45b99c5e80fa8280b61aed7e`، نسخهٔ `v0.5.0`.
- شاخهٔ اصلی آنلاین پس از دریافت تاریخچه: `833d908884d5c801f30f5c098d7977177eb3a36b`، آخرین کامیت 2026-07-28.
- آخرین انتشار رسمی: [v2.63.23](https://github.com/filebrowser/filebrowser/releases/tag/v2.63.23)، منتشرشده در 2026-07-27. مخزن اصلی هنگام بررسی `archived=true` بود؛ [README اصلی](https://github.com/filebrowser/filebrowser/blob/833d908884d5c801f30f5c098d7977177eb3a36b/README.md) توقف نگهداری از 2026-09-01 را اعلام می‌کند.
- جد مشترک: `6d44b3ae1d8d26484380bd90d8eb90a08a7fc062` در 2026-03-21.
- از جد مشترک، فورک ۶۵ کامیت و upstream تعداد ۱۶۱ کامیت اختصاصی دارد. این عدد به معنی ۱۶۱ باگ یا قابلیتِ ازدست‌رفته نیست: انتشار، ترجمه، مستندات و وابستگی‌ها هم در آن هستند. ۶۷ عنوان `fix`، یک عنوان `feat` و شش عنوان `test` وجود دارد؛ بعضی امکانات، مانند ادامهٔ انتقال، داخل کامیت‌های `fix` آمده‌اند.

نتیجه: چند اصلاح امنیتی مهم هنوز در فورک وجود ندارد. تعدادی از باگ‌فیکس‌های upstream را مستقل و گاهی کامل‌تر انجام داده‌ایم. رابط فورک React است و رابط upstream از Vue استفاده می‌کند؛ انتقال مستقیم تغییرات رابط یا ادغام کامل شاخه‌ها مناسب نیست. این بررسی تغییری در کد اجرایی یا فایل باینری ایجاد نکرده است.

## اصلاحات امنیتی باقی‌مانده

«بازتولید» یعنی رفتار فعلی در آزمون محلی با داده و پایگاه‌دادهٔ موقت مشاهده شد. «بررسی کد» یعنی تفاوت پیاده‌سازی تأیید شد، اما سناریوی عملی جداگانه اجرا نشد. اولویت‌ها ترتیب پیشنهادی کار هستند، نه امتیاز رسمی شدت آسیب‌پذیری.

| اولویت | مورد | وضعیت دقیق در فورک | شواهد upstream و محل محلی |
|---|---|---|---|
| فوری | خروج از محدودهٔ کاربر یا اشتراک از طریق symlink | `User.Clean` و اشتراک عمومی هنوز `afero.BasePathFs` می‌سازند. خواندن فایل بیرون scope از طریق symlink با آزمون تأیید شد. جلوگیری سراسری از دنبال کردن لینک خارجی و محدودسازی جداگانهٔ ریشهٔ اشتراک وجود ندارد. مسیرهای نوشتن، کپی و پاک‌سازی آپلود نیز باید با همان لایهٔ محدودکننده پوشش داده شوند. | [7c2c0a11](https://github.com/filebrowser/filebrowser/commit/7c2c0a11)، [64511ce4](https://github.com/filebrowser/filebrowser/commit/64511ce4)، [a1063925](https://github.com/filebrowser/filebrowser/commit/a1063925)، [403d2bbd](https://github.com/filebrowser/filebrowser/commit/403d2bbd). محلی: `users/users.go:96`، `http/public.go:65`. |
| فوری | خواندن متن و checksum بدون مجوز Download | `resourceGetHandler` بدون توجه به مجوز، `Content: true` می‌فرستد؛ شاخه‌های متن و checksum هم کنترل لازم را ندارند. با حساب غیرمدیر و `Download=false`، دریافت متن و checksum با پاسخ 200 بازتولید شد. رابط هم پیش‌نمایش متنی را در این وضعیت مجاز می‌داند و باید هماهنگ اصلاح شود. | [1e03fead](https://github.com/filebrowser/filebrowser/commit/1e03fead)، [6c69b5cd](https://github.com/filebrowser/filebrowser/commit/6c69b5cd). محلی: `http/resource.go:24`، `frontend/components/preview/file-preview.tsx`. |
| فوری | لینک عمومی پس از لغو مجوز صاحب آن همچنان کار می‌کند | مجوز Share/Download هنگام ساخت لینک بررسی می‌شود، اما هنگام استفاده از لینک، مجوز فعلی صاحب لینک دوباره بررسی نمی‌شود. ساخت لینک، لغو هر دو مجوز و دانلود موفق با همان لینک بازتولید شد. | [7dbf7a35](https://github.com/filebrowser/filebrowser/commit/7dbf7a35). محلی: `http/public.go:19`. |
| فوری | عبور عملیات بازگشتی از قوانین فایل‌های داخلی | کپی/انتقال و حذف فقط ریشهٔ عملیات را مجازسنجی می‌کنند. دسترسی مستقیم به فرزند ممنوع 403 است، ولی کپی پوشه، محتوای همان فرزند را کپی می‌کند و حذف پوشه آن را حذف می‌کند؛ هر دو بازتولید شدند. باید قواعد مبدأ و مسیرهای مقصد پیش از عملیات بازگشتی بررسی شوند. | [72faf6dd](https://github.com/filebrowser/filebrowser/commit/72faf6dd). محلی: `http/resource.go`، `http/data.go:32`. |
| بالا؛ مشروط به ثبت‌نام/ورود خودکار | وراثت Execute در ثبت‌نام و Admin/Execute در proxy؛ جداسازی خانهٔ کاربران | ثبت‌نام فقط Admin را حذف می‌کند و Execute/Commands را از defaults می‌گیرد. proxy نیز Admin/Execute را نگه می‌دارد. با `CreateUserDir=true` و scope پیش‌فرض `/`، کاربر proxy همچنان scope ریشه می‌گیرد. این دو رفتار بازتولید شدند. مسیر hook هم از نظر ایجاد خانه مشکل مشابه دارد؛ scope صریح hook باید حفظ شود. | [b6a4fb1f](https://github.com/filebrowser/filebrowser/commit/b6a4fb1f)، [f13c7c8c](https://github.com/filebrowser/filebrowser/commit/f13c7c8c)، [8ddd3d1d](https://github.com/filebrowser/filebrowser/commit/8ddd3d1d). محلی: `http/auth.go:145`، `auth/proxy.go:30`، `auth/hook.go`. |
| بالا؛ مشروط به ایجاد خانهٔ کاربر | دو نام کاربری می‌توانند خانهٔ یکسان بگیرند | نام‌های `teamone-x` و `teamone/x` به یک مسیر تبدیل شدند و هر دو حساب ثبت شدند. کنترل برخورد مسیر، برخورد با تفاوت حروف بزرگ/کوچک و ثبت اتمیک خانه وجود ندارد. برخورد نرمال‌شده بازتولید شد؛ حالت هم‌زمان و case folding بررسی کد هستند. | [883a36f0](https://github.com/filebrowser/filebrowser/commit/883a36f0)، [4b8a8d72](https://github.com/filebrowser/filebrowser/commit/4b8a8d72)، [fb6aeba9](https://github.com/filebrowser/filebrowser/commit/fb6aeba9). محلی: `settings/dir.go`، `users/storage.go`، `storage/bolt/users.go`. |
| بالا؛ مشروط به proxy و LogoutPage سفارشی | پذیرش توکن منقضی بدون هویت تأییدشدهٔ پراکسی | `renewableErr` در این پیکربندی صرفاً خطای انقضا را نادیده می‌گیرد. توکن یک روز قبل، بدون هدر هویت پراکسی، درخواست موفق گرفت؛ بازتولید شد. | [72faf6dd](https://github.com/filebrowser/filebrowser/commit/72faf6dd). محلی: `http/auth.go:67`. |
| بالا؛ وابسته به قوانین و سیستم‌فایل | ناهماهنگی قواعد مسیر با مسیر واقعی | `Rule.Matches` فقط `HasPrefix` دارد: قانون allow روی `/private` روی `/private-other` نیز اعمال می‌شود؛ بازتولید شد. نرمال‌سازی جداکننده‌های ویندوز، `..` و تشخیص سیستم‌فایل حساس/غیرحساس به بزرگی حروف نیز در لایهٔ مجازسنجی وجود ندارد؛ این بخش‌ها بررسی کد هستند. | [8adf127c](https://github.com/filebrowser/filebrowser/commit/8adf127c)، [e6d70cf2](https://github.com/filebrowser/filebrowser/commit/e6d70cf2). محلی: `rules/rules.go:30`، `http/data.go:32`. |
| بالا؛ نام فایل روی POSIX و استخراج در ویندوز | نام ناامن داخل ZIP | نامی مانند `..\..\outside.txt` در ZIP تولیدی بدون خنثی‌سازی باقی می‌ماند. وجود نام ناامن در آرشیو بازتولید شد؛ استخراج خارج از پوشه در ویندوز اجرا نشد و به ابزار استخراج وابسته است. باید اصلاح نهایی جایگزینی backslash با `_` و اعتبارسنجی entry منتقل شود، نه اصلاح اولیهٔ تبدیل به `/`. | [8503ba61](https://github.com/filebrowser/filebrowser/commit/8503ba61)، تکمیل [847d08bd](https://github.com/filebrowser/filebrowser/commit/847d08bd). محلی: `http/raw.go:124`. |
| بالا برای endpoint عمومی | نبود سقف اندازهٔ بدنهٔ login/signup | محدودیت ۱ مگابایتی upstream وجود ندارد. ورود معتبر با بدنهٔ بیش از ۲ مگابایت پذیرفته شد. این آزمون نبود محدودیت را نشان می‌دهد؛ آزمایش فشار یا مصرف کامل حافظه انجام نشد. | [847d08bd](https://github.com/filebrowser/filebrowser/commit/847d08bd). محلی: `http/auth.go:121` و `http/auth.go:145`. |
| متوسط | بازگرداندن hash رمز و token دورزدن رمز در API مدیریت اشتراک | ساخت و فهرست اشتراک مستقیماً `share.Link` را JSON می‌کنند و `password_hash`/`token` می‌دهند؛ بازتولید شد. این پاسخ برای کاربران مجازِ مدیریت اشتراک است، نه یک endpoint عمومیِ بدون احراز هویت. upstream پاسخ اختصاصی و `hasPassword` دارد. تغییر باید همراه با رابط انجام شود تا تشخیص Protected و دانلود اشتراک نشکند و شمارنده‌های اختصاصی فورک حفظ شوند. | [ec130546](https://github.com/filebrowser/filebrowser/commit/ec130546). محلی: `http/share.go`، `share/share.go`، `frontend/components/dialogs/share-dialog.tsx` و صفحهٔ Shares. |
| متوسط؛ تکمیل دفاع | مقایسهٔ token با زمان ثابت | هنوز مقایسه با `==` داریم. اصلاح کوچک upstream قابل انتقال است؛ سنجش حملهٔ زمانی انجام نشد. | [19514367](https://github.com/filebrowser/filebrowser/commit/19514367). محلی: `http/public.go:133`. |
| بالا در پیکربندی آسیب‌پذیر hook | جایگذاری اطلاعات ورود در آرگومان فرمان | `os.Expand` روی آرگومان‌های فرمان hook هنوز وجود دارد؛ اگر فرمان از shell استفاده کند، جایگذاری دادهٔ ورود خطر تزریق فرمان دارد. upstream این جایگذاری را حذف کرده و انتقال مقادیر از طریق environment را نگه داشته است. بررسی کد؛ بدون اجرای سناریوی تزریق. | [34ae34e7](https://github.com/filebrowser/filebrowser/commit/34ae34e7). محلی: `auth/hook.go:87`. |

## باگ‌فیکس‌ها و بهبودهای دیگر که هنوز نداریم

| مورد | وضعیت و اقدام پیشنهادی | کامیت |
|---|---|---|
| تمدید TTL آپلود Redis با HEAD | `GetLength` مقدار را می‌خواند ولی TTL را تمدید نمی‌کند؛ HEADهای ادامهٔ آپلود باید `Touch` کنند. تست با Redis واقعی انجام نشد. | [48125365](https://github.com/filebrowser/filebrowser/commit/48125365) |
| حذف امن آپلود رهاشده | حافظهٔ کش هنوز `os.Remove(item.Key())` روی مسیر واقعی اجرا می‌کند. باید callback حذف از فایل‌سیستم محدودشدهٔ همان کاربر باشد و فایل staging فورک را هدف بگیرد. | [9bd79c3a](https://github.com/filebrowser/filebrowser/commit/9bd79c3a) |
| نماندن آپلود TUS در حالت معلق بعد از رد شدن chunk | بدنهٔ درخواستِ ردشده تخلیه نمی‌شود؛ upstream بدنهٔ باقی‌مانده را با سقف مشخص می‌خواند تا پاسخ خطا در مرورگر به خطای اتصال تبدیل نشود. این سناریوی شبکه بازتولید نشد؛ فقط کد مقایسه شد. رابط فعلی فورک TUS مصرف نمی‌کند، اما API آن فعال است. | [0b925cbc](https://github.com/filebrowser/filebrowser/commit/0b925cbc) |
| نام و نوع پاسخ دانلود، و `nosniff` | inline هنوز filename ندارد؛ دانلود attachment باید `application/octet-stream` باشد؛ پاسخ‌های raw و static فاقد `X-Content-Type-Options: nosniff` هستند. CSP فعلی فورک باید حفظ شود. | [8f81b77c](https://github.com/filebrowser/filebrowser/commit/8f81b77c)، [103acd15](https://github.com/filebrowser/filebrowser/commit/103acd15)، [35db07d0](https://github.com/filebrowser/filebrowser/commit/35db07d0)، بخشی از [b21b1245](https://github.com/filebrowser/filebrowser/commit/b21b1245) |
| فهرست پوشه دارای فرزند غیرقابل‌دسترسی | fallback بر اساس نام فرزندان و رد کردن مورد غیرقابل‌خواندن وجود ندارد؛ امکان خطای کل فهرست باقی است. | [7b7ff8ae](https://github.com/filebrowser/filebrowser/commit/7b7ff8ae) |
| حفظ شکست خط SRT | `<br>` در ورودی SRT قبل از تبدیل به VTT نرمال نمی‌شود. | [d9cf2f01](https://github.com/filebrowser/filebrowser/commit/d9cf2f01) |
| اجرای upload hook برای ساخت پوشه | شاخهٔ ساخت پوشه مستقیماً `MkdirAll` می‌زند. hookهای آپلود باید برای پوشه هم اجرا شوند. | [9b78324d](https://github.com/filebrowser/filebrowser/commit/9b78324d) |
| اشتراک‌های یک فایل در پنجرهٔ مدیر | فهرست کلی همهٔ لینک‌ها را به مدیر می‌دهد، اما `shareGetsHandler` برای مسیرِ یک فایل فقط لینک‌های خود مدیر را برمی‌گرداند. باید تطبیق بر اساس مسیر واقعی و scope مالک باشد، نه صرفاً رشتهٔ مسیر. | [9cc18a81](https://github.com/filebrowser/filebrowser/commit/9cc18a81)، [43a404ca](https://github.com/filebrowser/filebrowser/commit/43a404ca) |
| اعتبارسنجی تنظیم Share بدون Download | کنترل زمان استفاده از Share را داریم، اما ذخیرهٔ ترکیب نامعتبرِ مجوزها در API ساخت/ویرایش کاربر هنوز رد نمی‌شود. | بخش اعتبارسنجی [0f39bd05](https://github.com/filebrowser/filebrowser/commit/0f39bd05) |
| اسکرول نوار کناری در ارتفاع کم | `<nav>` هنوز `overflow-y-auto` و محدودیت ارتفاع انعطاف‌پذیر ندارد. بهبود رابط باید در React بازنویسی شود. | [a789f29c](https://github.com/filebrowser/filebrowser/commit/a789f29c) |
| به‌روزرسانی وابستگی‌ها | `postcss` در lockfile فورک `8.5.8` است، درحالی‌که upstream اصلاح امنیتی `8.5.18` را دارد. در Go هم نسخه‌های جدیدتری برای `x/crypto`، `x/net`، `x/image`، bbolt و چند وابستگی دیگر وجود دارد؛ تفاوت نسخه به‌تنهایی اثبات آسیب‌پذیری نیست و باید جداگانه بررسی و آزمایش شود. DOMPurify فورک `3.4.17` است و از اصلاح `3.4.12` upstream عقب نیست. | [9dd7c7d0](https://github.com/filebrowser/filebrowser/commit/9dd7c7d0)، [41b01a74](https://github.com/filebrowser/filebrowser/commit/41b01a74)، [91e68edb](https://github.com/filebrowser/filebrowser/commit/91e68edb) |

## امکانات کاربردی برای انتقال به رابط خودمان

1. **ادامهٔ واقعی آپلود بعد از قطع ارتباط** و انتخاب Resume هنگام تداخل: سرور فورک TUS دارد، اما `upload-dialog.tsx` فقط POST معمولی می‌فرستد. Retry فعلی کل فایل را از ابتدا می‌فرستد. اتصال رابط به TUS، نگهداری offset و انتخاب فایل یکسان لازم است. منبع: [f4e14852 / #5884](https://github.com/filebrowser/filebrowser/commit/f4e14852)، همراه اصلاحات [0b925cbc](https://github.com/filebrowser/filebrowser/commit/0b925cbc).
2. **پنجرهٔ حل تداخل نام** با انتخاب نگه‌داشتن هر دو/جایگزینی/رد کردن و تصمیم گروهی: اکنون آپلودِ نام تکراری صرفاً خطای 409 می‌دهد و دوباره تلاش کردن همان خطا را تکرار می‌کند. API فایل گزینه‌های overwrite/rename دارد، ولی این گردش کار در رابط کامل نشده است. API فهرست بازگشتی `/api/resources/recursive` در upstream زیرساخت بررسی پوشه‌ها را اضافه کرده و در فورک نداریم؛ استفادهٔ آن باید فقط برای آپلود پوشه و با رعایت قواعد دسترسی باشد. منابع: [f4e14852](https://github.com/filebrowser/filebrowser/commit/f4e14852)، [c1abe8f5](https://github.com/filebrowser/filebrowser/commit/c1abe8f5)، [a1a514dc](https://github.com/filebrowser/filebrowser/commit/a1a514dc)، [dfc2e887](https://github.com/filebrowser/filebrowser/commit/dfc2e887).
3. **جابجایی فایل داخل برنامه با Drag & Drop و کپی با Ctrl**: Drag & Drop فعلی فورک برای آپلود فایل از بیرون برنامه است. فایل‌های داخل فهرست هنوز drag source/destination ندارند. در macOS می‌توان نگاشت کلید مناسب را هنگام طراحی رابط تصمیم گرفت؛ کامیت upstream از Ctrl استفاده می‌کند. منبع: [876cdb34 / #5882](https://github.com/filebrowser/filebrowser/commit/876cdb34).
4. **نمایش لینک‌های همهٔ کاربران برای فایل جاری به مدیر**: بخش کلی Shares کافی نیست؛ مدیر هنگام بررسی همان فایل هم باید لینک‌های مرتبط را ببیند، با تطبیق scope مالک. منابع: [9cc18a81](https://github.com/filebrowser/filebrowser/commit/9cc18a81)، [43a404ca](https://github.com/filebrowser/filebrowser/commit/43a404ca).

## مواردی که از قبل پوشش داده‌ایم یا انتقال مستقیمشان کاربرد ندارد

| تغییر upstream | وضعیت فورک |
|---|---|
| [7a16129b](https://github.com/filebrowser/filebrowser/commit/7a16129b)، [4daddec6](https://github.com/filebrowser/filebrowser/commit/4daddec6): طول منفی/بیشتر از طول اعلامی TUS | `uploadIntegerHeader` اعداد منفی را رد می‌کند و PATCH طول باقی‌مانده را محدود و chunk نامعتبر را rollback می‌کند. آزمون `TestResumableUploadPreservesOriginalUntilComplete` رفتار را پوشش می‌دهد. |
| [e07c59df](https://github.com/filebrowser/filebrowser/commit/e07c59df): قواعد زیرپوشه در اشتراک عمومی | با `scopePrefix` و آزمون `TestPublicShareKeepsOriginalAccessRules` مستقل پوشش داده‌ایم. این پوشش، مشکل symlink یا مجوز فعلی مالک را حل نمی‌کند. |
| [0231b7eb](https://github.com/filebrowser/filebrowser/commit/0231b7eb)، [f30fca63](https://github.com/filebrowser/filebrowser/commit/f30fca63): حذف لینک کاربر دیگر/باقی ماندن لینک پوشه با اسلش | مسیر جاری از `UpdateUserPaths(userID, ...)` استفاده می‌کند؛ هم شناسهٔ مالک و هم مرز مسیر و حذف اسلش انتهایی را رعایت می‌کند. helper قدیمی `DeleteWithPathPrefix` را نباید دوباره وارد مسیر فعال کرد. |
| [166583db](https://github.com/filebrowser/filebrowser/commit/166583db): اشتراک مسیر ناموجود | پیش از ساخت لینک `NewFileInfo` اجرا می‌شود؛ آزمون موجود پاسخ 404 را کنترل می‌کند. خروج از scope از طریق symlink همچنان موضوع جداگانه است. |
| [ac46cf06](https://github.com/filebrowser/filebrowser/commit/ac46cf06): panic هنگام کپی پوشهٔ ناخوانا | `CopyDir` فعلی خطای باز کردن پوشه را قبل از defer/استفاده بررسی می‌کند؛ اختلاف فعلی آن فایل با upstream تنها یک خط خالی است. |
| [5328e80d](https://github.com/filebrowser/filebrowser/commit/5328e80d): CSV با تعداد ستون متفاوت | جدول React بر اساس بیشترین تعداد ستون سطرها ساخته می‌شود و خانه‌های خالی را پر می‌کند؛ محدودیت مساوی بودن عرض سطرها ندارد. |
| [0fadf28b](https://github.com/filebrowser/filebrowser/commit/0fadf28b): کلیدهای جهت هنگام کار با ویدئو | handler رابط ما هدف‌های `video,audio` و کنترل‌های تعاملی را کنار می‌گذارد؛ منطق Vue قابل انتقال مستقیم نیست. بررسی کد؛ این نوبت آزمون تعاملی مرورگر انجام نشد. |
| [0bb27687](https://github.com/filebrowser/filebrowser/commit/0bb27687): مرتب‌سازی در موبایل | header فورک چیدمان موبایل مستقل دارد و Select مرتب‌سازی مخفی نشده است. بررسی کد. |
| [6ad8160a](https://github.com/filebrowser/filebrowser/commit/6ad8160a): catchAll ریشهٔ Vue Router | مسیرها با React Router پیاده‌سازی شده‌اند؛ کد معیوب Vue در فورک وجود ندارد. |
| [432f3e60](https://github.com/filebrowser/filebrowser/commit/432f3e60)، [7361d91e](https://github.com/filebrowser/filebrowser/commit/7361d91e): مسیر/تداخل آپلود Vue | همان uploader و `readEntries` در فورک وجود ندارند. هنگام افزودن آپلود پوشه و TUS باید معادل رفتار درست پیاده شود؛ cherry-pick رابط فعلی مناسب نیست. |
| [126227bb](https://github.com/filebrowser/filebrowser/commit/126227bb)، [aac25166](https://github.com/filebrowser/filebrowser/commit/aac25166): EPUB | فورک reader مربوط به EPUB را ندارد؛ این دو باگ‌فیکس به renderer فعلی اعمال نمی‌شوند. EPUB یک کمبود قدیمی‌تر از این بازه است، نه قابلیت جدید این کامیت‌ها. |
| [d9f9460c](https://github.com/filebrowser/filebrowser/commit/d9f9460c)، [c406bda0](https://github.com/filebrowser/filebrowser/commit/c406bda0): قالب HTML و JSON | `text/template` هنوز در backend موجود است، ولی `frontend/index.html` فعلی قالب تزریق دادهٔ قدیمی Vue را ندارد و تنظیمات را جدا می‌گیرد؛ سناریوی قدیمی را نمی‌توان صرفاً از import آسیب‌پذیر دانست. تبدیل سازگار به `html/template` و بررسی escape در مسیرهای branding یک بهبود دفاعی است. |
| [cfff8430](https://github.com/filebrowser/filebrowser/commit/cfff8430): آیکن PWA | ساختار manifest و PWA upstream در رابط فعلی فورک وجود ندارد؛ اصلاح مسیر آن مستقیماً کاربرد ندارد. |
| کامیت‌های ترجمه، CI، انتشار و مستندات | بستهٔ ترجمهٔ Vue و شماره‌نسخهٔ upstream نباید روی ساختار و نسخه‌گذاری مستقل فورک جایگزین شوند. اصلاحات محیط انتشار باید بر اساس pipeline خود فورک انتخاب شوند. |

## روش انتقال پیشنهادی

1. اصلاحات امنیتی backend: فایل‌سیستم محدودشده و مجموعهٔ تکمیل‌کنندهٔ symlink، مجوزهای منابع و اشتراک عمومی، قواعد بازگشتی/مسیر، جداسازی و ثبت اتمیک خانهٔ کاربر، ورود و ZIP. هر گروه با تست بازگشتیِ انتظار رفتار امن منتقل شود.
2. تکمیل امنیت اشتراک با پاسخ `hasPassword` در backend و هماهنگی رابط؛ شمارنده‌های Visit/Download/Auth فورک حفظ شوند. سپس headerها و چرخهٔ عمر کش آپلود.
3. امکانات رابط React: ادامهٔ آپلود و حل تداخل، سپس Drag & Drop داخلی و لینک‌های فایل برای مدیر.
4. به‌روزرسانی وابستگی‌ها و بهبودهای کوچک مانند SRT و اسکرول sidebar در تغییرات جداگانه.

انتقال باید به‌صورت انتخابی و با بازنویسی importهای ماژول انجام شود. زنجیرهٔ symlink چند اصلاح متوالی دارد؛ انتقال فقط نخستین کامیت، اصلاح ناقص ایجاد می‌کند. برعکس، کپی کامل `resource.go` یا uploader upstream می‌تواند نوشتن اتمیک فایل‌ها، staging آپلود TUS، پشتیبانی `move`، encoding یک‌بارهٔ مسیرها، جابه‌جایی مسیر اشتراک‌ها و اعتبارسنجی‌های اختصاصی فورک را از بین ببرد. این موارد باید حفظ شوند.

## آزمون‌های این بررسی

- ۱۰ آزمون موقت اختصاصی، به‌علاوهٔ دو زیرآزمون کپی و حذف، اجرا شدند. هر ۱۰ آزمون رفتار ناامنِ مورد انتظار برای بررسی را مشاهده کردند: متن/checksum، افشای پاسخ اشتراک و مجوز مالک، عملیات بازگشتی، symlink، ثبت‌نام/برخورد خانه، توکن پراکسی، ZIP، مرز قانون، سقف بدنهٔ login و provision کاربر proxy. **PASS در این آزمون‌ها به معنی تأیید وجود مشکل است، نه امن بودن برنامه.**
- از پایگاه‌داده‌ها و پوشه‌های موقت و فایل‌سیستم حافظه‌ای استفاده شد؛ فایل‌های کاربر و پایگاه‌دادهٔ اصلی وارد آزمایش نشدند.
- آزمون‌های موجود `files`، `fileutils` و `rules` موفق بودند؛ بستهٔ `users` تست اجرایی موجود ندارد.
- ۲۲ آزمون frontend موفق بودند.
- مجموعهٔ HTTP ابتدا در آزمون WebSocket به دلیل ممنوع بودن باز کردن پورت محلی در محیط اجرا متوقف شد؛ این محدودیت محیط است. اجرای مجدد با کنار گذاشتن فقط `TestCommandStreamsStdoutAndStderrAndClosesNormally` موفق بود.
- آزمون‌های امنیتی موقت پس از بررسی از کد پروژه حذف شدند. کد آن‌ها در `/tmp/filebrowser-upstream-audit-probes.go` و خروجی در `/tmp/filebrowser-upstream-audit-results.txt` باقی است؛ این فایل‌های موقت تضمین ماندگاری ندارند. اصلاحی روی برنامه اعمال نشده است.
- Redis واقعی، استخراج ZIP در ویندوز، فایل‌سیستم case-insensitive به‌عنوان سناریوی دسترسی، رقابت هم‌زمان provisioning، قطع اتصال مرورگر در PATCH و اجرای hook خارجی در این نوبت آزمایش نشدند. موارد مربوط به آن‌ها بر اساس مقایسهٔ کد گزارش شده‌اند.

## فهرست کامل کامیت‌های upstream در بازهٔ بررسی

فهرست زیر موجودی تاریخچه است؛ وضعیت قابلیت‌ها و باگ‌فیکس‌ها در بخش‌های بالا توضیح داده شده و نبود SHA یکسان به معنی نبود اصلاح معادل در فورک نیست.

- 2026-03-26 [48125365](https://github.com/filebrowser/filebrowser/commit/48125365551ce2b27790aaafd7594cf5ce52f1ba) — fix: touch Redis upload cache key on GetLength to prevent TTL expiry (#5850)
- 2026-03-28 [ae72f936](https://github.com/filebrowser/filebrowser/commit/ae72f9366704490a5cc3ce3cff7b18d405415653) — chore(deps): update actions/deploy-pages action to v5 (#5866)
- 2026-03-28 [432f3e60](https://github.com/filebrowser/filebrowser/commit/432f3e60ffdf92af6f8f56119a1bac8084f52a60) — fix: double slash in TUS upload path when readEntries returns multiple batches (#5848)
- 2026-03-28 [0616f681](https://github.com/filebrowser/filebrowser/commit/0616f6811f9b4ecfb15b3ad812a0c4f03c889326) — chore: Updates for project File Browser (#5847)
- 2026-03-28 [8f81b77c](https://github.com/filebrowser/filebrowser/commit/8f81b77cf2a3da0a445f3700fbf4a0091ea46c07) — fix: include filename in Content-Disposition header for inline downloads (#5860)
- 2026-03-28 [8d8cd26d](https://github.com/filebrowser/filebrowser/commit/8d8cd26d7f20d79bc24a01afb2574c7fb7a92b36) — chore(deps): update all non-major dependencies (#5838)
- 2026-03-28 [2368e468](https://github.com/filebrowser/filebrowser/commit/2368e468b9e3cea0e8e4b02ec8b12409767be8f1) — chore(deps): update pnpm/action-setup action to v5 (#5869)
- 2026-03-28 [b6a4fb1f](https://github.com/filebrowser/filebrowser/commit/b6a4fb1f27f4d894b384c0f3acacda276d1338a5) — fix: self-registered users don't get execute perms
- 2026-03-28 [126227bb](https://github.com/filebrowser/filebrowser/commit/126227bb2754eee15cd7c722916c3bb8821084a2) — fix: disable scripted content in epub
- 2026-03-28 [d9f9460c](https://github.com/filebrowser/filebrowser/commit/d9f9460c1e51d10a25065e10358c12d5ced66ad9) — fix: use html/template
- 2026-03-28 [c406bda0](https://github.com/filebrowser/filebrowser/commit/c406bda0c73ac8b187e23a97c05521edc77efa84) — fix: json escaping
- 2026-03-28 [a8fc1657](https://github.com/filebrowser/filebrowser/commit/a8fc1657b796c5da7190466beff13e680721b6d3) — fix: shares listing
- 2026-03-28 [860c19dd](https://github.com/filebrowser/filebrowser/commit/860c19ddf58665aafcf976f5299a907738214226) — chore(release): 2.62.2
- 2026-04-04 [0f39bd05](https://github.com/filebrowser/filebrowser/commit/0f39bd055efdadc15abd2f8146cf5da3793f8318) — fix: check download permission when sharing permission is enabled (#5875)
- 2026-04-04 [7a16129b](https://github.com/filebrowser/filebrowser/commit/7a16129bfc07dbdc2fa52b99d2985c1bc0ea12e2) — fix(tus): reject negative upload-length to prevent inconsistent cache entry (#5876)
- 2026-04-04 [2f805de5](https://github.com/filebrowser/filebrowser/commit/2f805de5274514c627f61e2b648fc7a9b8eadb2c) — docs: update docker compose
- 2026-04-04 [876cdb34](https://github.com/filebrowser/filebrowser/commit/876cdb34265b090c2a74a69509f4106f2c5e8726) — feat: enable copy operation on drag‑and‑drop with ctrl key (#5882)
- 2026-04-04 [65a837de](https://github.com/filebrowser/filebrowser/commit/65a837de4916c054a89258bf84b35f075158a1b5) — chore(release): 2.63.0
- 2026-04-04 [7dbf7a35](https://github.com/filebrowser/filebrowser/commit/7dbf7a3528234b2a9ee9c4115e8ecf58d258ca51) — fix: check share owner permissions on public share access (#5888)
- 2026-04-04 [8adf127c](https://github.com/filebrowser/filebrowser/commit/8adf127c7d33585333b8030869f6f318e6517179) — fix: enforce directory boundary in rule path matching (#5889)
- 2026-04-04 [1e03fead](https://github.com/filebrowser/filebrowser/commit/1e03feadb550e4414b5589a6a8df57f538efba15) — fix: check download permission in resource handler (#5891)
- 2026-04-04 [f13c7c8c](https://github.com/filebrowser/filebrowser/commit/f13c7c8cffd6d58ff29c4a6763ced1385f69961e) — fix: restrict default permissions for proxy-auth auto-provisioned users (#5890)
- 2026-04-04 [29c73eac](https://github.com/filebrowser/filebrowser/commit/29c73eaca6a7b91f0de3c73536a0d0a21eeda03e) — chore(release): 2.63.1
- 2026-04-11 [871f3378](https://github.com/filebrowser/filebrowser/commit/871f33789259d644ec3ed89aa38f6bf20b72c42a) — chore(deps): update pnpm/action-setup action to v6 (#5898)
- 2026-04-11 [0fadf28b](https://github.com/filebrowser/filebrowser/commit/0fadf28b18e506ddca0027e83ebe567ac57932bf) — fix(preview): let arrow keys seek video instead of switching files (#5895)
- 2026-04-11 [23e84c99](https://github.com/filebrowser/filebrowser/commit/23e84c997422ef058dc8e348cba75e77b23aaf84) — docs: update PR template
- 2026-04-11 [0321415a](https://github.com/filebrowser/filebrowser/commit/0321415a152b6c20e44c6f4afbffd0ed34919e22) — chore: pull translations (#5871)
- 2026-04-11 [9b80a9aa](https://github.com/filebrowser/filebrowser/commit/9b80a9aa6cf87700624fa6e0ba5fe8eac71d84d7) — chore(deps): update all non-major dependencies (#5870)
- 2026-04-11 [dd53644a](https://github.com/filebrowser/filebrowser/commit/dd53644acbecd7b8b788396aa8dd133ae006382c) — chore(release): 2.63.2
- 2026-04-18 [7f8b920a](https://github.com/filebrowser/filebrowser/commit/7f8b920aa4c2eb22d22bad7763e7fd880b63333d) — chore(deps): update actions/upload-pages-artifact action to v5 (#5913)
- 2026-04-18 [da6b7ac2](https://github.com/filebrowser/filebrowser/commit/da6b7ac26b7d2dce84131435885e144492859146) — chore(deps): update all non-major dependencies (#5912)
- 2026-04-18 [41b801d3](https://github.com/filebrowser/filebrowser/commit/41b801d30c736c8ca863e2be6aece7d99e92129e) — fix: correct environment variable in compose.yaml (#5910)
- 2026-04-18 [9f4288b1](https://github.com/filebrowser/filebrowser/commit/9f4288b1b4e8e197ec2ec2ca093e7bf761efd142) — docs: Update documentation links in Global.vue (#5905)
- 2026-04-18 [7bd27f5e](https://github.com/filebrowser/filebrowser/commit/7bd27f5e823651420cedd87a6c6503b1a954a4dd) — chore: sync translations (#5901)
- 2026-04-28 [74917c80](https://github.com/filebrowser/filebrowser/commit/74917c80370ef97e3cb973ab2a751d0aa61d4c62) — chore(deps): update all non-major dependencies (#5915)
- 2026-04-28 [a1a7ac4f](https://github.com/filebrowser/filebrowser/commit/a1a7ac4f04706200cdd29a86951a84b7e5461520) — chore: update translations (#5918)
- 2026-04-28 [4edf425a](https://github.com/filebrowser/filebrowser/commit/4edf425a9fae15b7e555b033f33c77ddf1302f61) — chore(i18n): add a translation for disk usage (#5916)
- 2026-04-28 [d236f1c5](https://github.com/filebrowser/filebrowser/commit/d236f1c563eee40488ee9cea0745bda4f2b261a4) — chore(deps): update dependency marked to v18 (#5897)
- 2026-05-05 [e2bdf6f7](https://github.com/filebrowser/filebrowser/commit/e2bdf6f747dc90123a555ba58390aff2e34bf9dd) — chore: update translations
- 2026-05-05 [1f22fe65](https://github.com/filebrowser/filebrowser/commit/1f22fe65ecc41ff9ca6dc3128bb914793dd5b44f) — chore(deps): update all non-major dependencies (#5926)
- 2026-05-05 [f4e14852](https://github.com/filebrowser/filebrowser/commit/f4e148523e0dc9242081831b53544396f995c611) — fix: Fix conflict modal and add a resume transfert option (#5884)
- 2026-05-05 [ca5e249e](https://github.com/filebrowser/filebrowser/commit/ca5e249e3c0c94159c2136a0cd431a424eb18472) — chore(release): 2.63.3
- 2026-05-17 [261bca67](https://github.com/filebrowser/filebrowser/commit/261bca67bc7e0a4c188cb8d57522998ae9fdb735) — chore(deps): update all non-major dependencies (#5929)
- 2026-05-17 [da2dff09](https://github.com/filebrowser/filebrowser/commit/da2dff0933e7f8795ba39fe2bad88d0e0dab66f4) — chore: sync translations
- 2026-05-17 [e38c2827](https://github.com/filebrowser/filebrowser/commit/e38c28273aa85329fd9d796c1dd66fa07289b1ab) — chore: fix typo
- 2026-05-17 [9cc18a81](https://github.com/filebrowser/filebrowser/commit/9cc18a81e3e1b8bf96795bfbe3d83ced294ecfd7) — fix: show item shares from all users to admins (#5941)
- 2026-05-17 [d978d1ec](https://github.com/filebrowser/filebrowser/commit/d978d1eccae6127618681333490afa0613e7d2ec) — chore: sync translations (#5945)
- 2026-05-17 [a418dd6b](https://github.com/filebrowser/filebrowser/commit/a418dd6bb367a609cb38835f9a76e94df995f37e) — chore: revert node dependencies updates
- 2026-05-17 [22b848f2](https://github.com/filebrowser/filebrowser/commit/22b848f26ef8ae889eef132232dbd0de347e0efd) — chore(release): 2.63.4
- 2026-05-21 [6ad8160a](https://github.com/filebrowser/filebrowser/commit/6ad8160aa3309314c1b471c5090b67c824464396) — fix(router): handle undefined catchAll param on root redirect (#5955)
- 2026-05-21 [a1e442ef](https://github.com/filebrowser/filebrowser/commit/a1e442ef9e4a14719184bf02c50dbc981ecf8665) — chore(release): 2.63.5
- 2026-05-21 [ca0108f0](https://github.com/filebrowser/filebrowser/commit/ca0108f0709741828c5d4c9f0406e2b25dd7ca88) — chore: disable automatic major updates
- 2026-06-03 [34ae34e7](https://github.com/filebrowser/filebrowser/commit/34ae34e764d72540c039f1f5ea2ec4c974168c1f) — fix: remove undocumented hook auth with shell replacement
- 2026-06-03 [0d3eb9be](https://github.com/filebrowser/filebrowser/commit/0d3eb9bea96127e6d7b53a84f4551d709affe865) — docs: clarify hide dotfiles
- 2026-06-03 [e07c59df](https://github.com/filebrowser/filebrowser/commit/e07c59df0b850f5924d5b1683e8609661ddcf534) — fix: incorrect access control in public directory shares via rule path rebasing
- 2026-06-03 [0231b7eb](https://github.com/filebrowser/filebrowser/commit/0231b7ebdfbe77a6c54027d30c4856c3fd81ee4d) — fix: cross-user unauthorized share-link deletion
- 2026-06-03 [847d08bd](https://github.com/filebrowser/filebrowser/commit/847d08bdd135e5c3659f2e6dea2f0cd36617af9b) — fix: address three security disclosures (archive traversal, login DoS, symlink escape)
- 2026-06-03 [5328e80d](https://github.com/filebrowser/filebrowser/commit/5328e80d2e88d1c279a1250a7dfee4fc96f703ec) — fix: parse csv files with uneven columns in their rows (#5965)
- 2026-06-03 [10368306](https://github.com/filebrowser/filebrowser/commit/103683069e077fa5976da7bb4b390110a68bdc30) — chore: Updates for project File Browser (#5947)
- 2026-06-03 [4edabb9c](https://github.com/filebrowser/filebrowser/commit/4edabb9ccc74c8b0bc80f0ac6af121d106ca6647) — chore(docs): update CLI documentation
- 2026-06-03 [85b7d276](https://github.com/filebrowser/filebrowser/commit/85b7d2762dda67b6158220991654c65b43739005) — chore(release): 2.63.6
- 2026-06-03 [166583db](https://github.com/filebrowser/filebrowser/commit/166583db632e088e9f0adce30aec43bb9d9019f4) — fix: disallow shares for non-existent paths
- 2026-06-03 [4488f5b1](https://github.com/filebrowser/filebrowser/commit/4488f5b1315c9decd3c04af2b76518745c3e4ab2) — chore(release): 2.63.7
- 2026-06-03 [ca019ae7](https://github.com/filebrowser/filebrowser/commit/ca019ae7d966a7c28de2b2341271cd13e3458ae6) — fix: check if share is within scope when creating
- 2026-06-03 [f5e0c4e2](https://github.com/filebrowser/filebrowser/commit/f5e0c4e2e18902e51d6264ff87874265fc623c62) — chore(release): 2.63.8
- 2026-06-03 [103acd15](https://github.com/filebrowser/filebrowser/commit/103acd15fe57554fe0246bfe70a49b6cb4ae0c51) — fix: force octet-stream for attachment downloads (#5942)
- 2026-06-03 [cdd666fc](https://github.com/filebrowser/filebrowser/commit/cdd666fc95f569ad583c32391e45646fed676dfd) — fix: prevent symlink scope escape in copy/move/rename
- 2026-06-03 [19514367](https://github.com/filebrowser/filebrowser/commit/19514367adf2d9fe5be2b7666e397979ea679b94) — fix: use constant-time comparison for share access token
- 2026-06-03 [35db07d0](https://github.com/filebrowser/filebrowser/commit/35db07d0159c520a6b3c969ac52033593914fadd) — fix: set X-Content-Type-Options: nosniff on raw file responses
- 2026-06-03 [503fd6b0](https://github.com/filebrowser/filebrowser/commit/503fd6b01f311bf432b3fcf840acc5c79f23148f) — chore(release): 2.63.9
- 2026-06-03 [6b04cbf5](https://github.com/filebrowser/filebrowser/commit/6b04cbf5e9db1f5b9c0b1624843607ce2881cfc4) — fix: allow writes when user scope resolves to filesystem root
- 2026-06-03 [69c76d11](https://github.com/filebrowser/filebrowser/commit/69c76d11cc865e1d959f715f7b35bb905c14079f) — chore(release): 2.63.10
- 2026-06-04 [3471ec2c](https://github.com/filebrowser/filebrowser/commit/3471ec2c4b6473831c72ee889cb3c1a6849a1fb1) — fix: incomplete fix for symlinked directories let scopes users and public-share recipients read and write files outside of scope
- 2026-06-04 [1086903c](https://github.com/filebrowser/filebrowser/commit/1086903c14553545aef0f1a5321011cb139aca3d) — chore(release): 2.63.11
- 2026-06-04 [7b7ff8ae](https://github.com/filebrowser/filebrowser/commit/7b7ff8ae8f97393b2e6ae6e061c1f780077c32b6) — fix: skip inaccessible children when listing directories (#5958)
- 2026-06-04 [0bb27687](https://github.com/filebrowser/filebrowser/commit/0bb2768754d11b865d68e72dcd7cebb232a6308a) — fix: keep mobile file sort controls visible (#5977)
- 2026-06-04 [c1abe8f5](https://github.com/filebrowser/filebrowser/commit/c1abe8f561208bf36bde70879d1a15ef9de998fa) — fix: await copy move conflict detection (#5978)
- 2026-06-04 [998bd95b](https://github.com/filebrowser/filebrowser/commit/998bd95bfad1a9fbb81d214a77b168a393639718) — chore(release): 2.63.12
- 2026-06-06 [5f7311d3](https://github.com/filebrowser/filebrowser/commit/5f7311d32437e98d7c14c7b307a4f68109275535) — refactor: cleanup and simplify upload.ts
- 2026-06-06 [a1a514dc](https://github.com/filebrowser/filebrowser/commit/a1a514dcbb216d2080412c5354eea1e1fb033050) — fix: copy/move allow overwrite
- 2026-06-06 [67ed670d](https://github.com/filebrowser/filebrowser/commit/67ed670d92966e0c8b57d7b726572be6b905fe8a) — chore(release): 2.63.13
- 2026-06-07 [3406d3d7](https://github.com/filebrowser/filebrowser/commit/3406d3d7f98dfc3c16e4ff7ff4a87e3bdfe221dd) — fix: recursive check
- 2026-06-07 [7c2c0a11](https://github.com/filebrowser/filebrowser/commit/7c2c0a11b31b2bb214d741005a0b02b1764208b3) — refactor: ScopedFs to avoid escaping symlinks
- 2026-06-07 [d9816b15](https://github.com/filebrowser/filebrowser/commit/d9816b153194198d717e14cdbe32f83ef57e076c) — chore: add symlink tests
- 2026-06-07 [dfe6e5b3](https://github.com/filebrowser/filebrowser/commit/dfe6e5b333e3211dd6ced146672657de598299c7) — chore(release): 2.63.14
- 2026-06-13 [403d2bbd](https://github.com/filebrowser/filebrowser/commit/403d2bbd3357aa57e78745b52dcdad3490901bb3) — fix: restore ScopedFs RealPath (#5986)
- 2026-06-13 [ffb486e0](https://github.com/filebrowser/filebrowser/commit/ffb486e05fe0d38f09a3067d1f16a71628726d15) — chore: bump minor Go dependencies
- 2026-06-13 [be23ab3a](https://github.com/filebrowser/filebrowser/commit/be23ab3a15bf957928ecfed88de5ab67850c1b9c) — chore(release): 2.63.15
- 2026-06-23 [64511ce4](https://github.com/filebrowser/filebrowser/commit/64511ce45e3be379e965f7f4fb0929a068d5bb81) — fix: dangling symlink, write, delete scope bugs
- 2026-06-23 [a1063925](https://github.com/filebrowser/filebrowser/commit/a1063925e15ef27f9d5dc26aae371bbf52af608c) — fix: restore symlink behavior as opt-in followExternalSymlinks
- 2026-06-23 [8cfa6a17](https://github.com/filebrowser/filebrowser/commit/8cfa6a175f428f89ef2c349e3d43166ee0c60135) — chore(docs): update CLI documentation
- 2026-06-23 [bd1520fe](https://github.com/filebrowser/filebrowser/commit/bd1520fe095d2f373f8fbcbfc01f855ade7e90fb) — chore(release): 2.63.16
- 2026-06-27 [6209f8fd](https://github.com/filebrowser/filebrowser/commit/6209f8fddd0f279b4d57571c0d5bb114affc1942) — chore: update translations (#5990)
- 2026-06-27 [d9cf2f01](https://github.com/filebrowser/filebrowser/commit/d9cf2f0100d2c4892cad8e339eacca96df1aa5b6) — fix: preserve SRT subtitle line breaks (#6002)
- 2026-06-27 [43a404ca](https://github.com/filebrowser/filebrowser/commit/43a404ca69bf25553bfbbb2b446f0f53077c6302) — fix: match admin share paths by owner scope (#5992)
- 2026-06-27 [2472fbcd](https://github.com/filebrowser/filebrowser/commit/2472fbcd30502606feb11fbc8b8dc4f3803e6641) — fix: normalize recursive listing paths to forward slashes (#6003)
- 2026-06-27 [1fb05d65](https://github.com/filebrowser/filebrowser/commit/1fb05d65de98f8dc341409f40d382297ca75bcf0) — docs,cmd: warn about broad scope for self-signup users (GHSA-6759-996p-gpj6)
- 2026-06-27 [8503ba61](https://github.com/filebrowser/filebrowser/commit/8503ba61ff51d48a7313896483d130eb6a5abfe0) — fix(raw): neutralize backslashes in archive entry names (GHSA-83xp-526h-j3ww)
- 2026-06-27 [883a36f0](https://github.com/filebrowser/filebrowser/commit/883a36f02fcb69566a8628cb47f18fdc73348387) — fix(auth): reject signup when normalized home dir collides (GHSA-7rc3-g7h6-22m7)
- 2026-06-27 [ec130546](https://github.com/filebrowser/filebrowser/commit/ec130546713c44cd24556907552ac554c7f809c9) — fix(share): stop exposing password hash and bypass token in share API (GHSA-833g-cqhp-h72j)
- 2026-06-27 [f30fca63](https://github.com/filebrowser/filebrowser/commit/f30fca636c1af9ef401e9a82ff60391cb3db97e1) — fix(share): delete exact directory share on trailing-slash delete (GHSA-pp88-jhwj-5qh5)
- 2026-06-27 [d76b7d16](https://github.com/filebrowser/filebrowser/commit/d76b7d161099853f17e71b1327ce4545a30c27a2) — chore(release): 2.63.17
- 2026-06-27 [c05ead7e](https://github.com/filebrowser/filebrowser/commit/c05ead7e8e23b6d6c9c9e11271bf8d5e74169f4a) — docs: warning about hook executor
- 2026-07-04 [aac25166](https://github.com/filebrowser/filebrowser/commit/aac25166378422135e624e305c410c54a39374fb) — fix(preview): keep the EPUB table-of-contents button clear of the header (#6010)
- 2026-07-04 [dfc2e887](https://github.com/filebrowser/filebrowser/commit/dfc2e887e1a19d54984a0d7e39a2a63caf73ef19) — fix: avoid recursive conflict checks for copy and move (#6009)
- 2026-07-04 [58d22578](https://github.com/filebrowser/filebrowser/commit/58d22578e8d7517420feda161fcb9d4749518690) — chore: update dependencies
- 2026-07-04 [4470288b](https://github.com/filebrowser/filebrowser/commit/4470288ba1828a14453a99348fd22c62aa0b9460) — fix: deduplicate PT language
- 2026-07-04 [2651260a](https://github.com/filebrowser/filebrowser/commit/2651260a1ccab6d7b30e065de05992818acdb65b) — chore: update translations
- 2026-07-04 [fe7efb2e](https://github.com/filebrowser/filebrowser/commit/fe7efb2e6afe66774cd86a5b0a03033bd514d0c0) — chore(release): 2.63.18
- 2026-07-17 [9b78324d](https://github.com/filebrowser/filebrowser/commit/9b78324d773c790951cc6a97840c4b55f66b5f3d) — fix(http): run upload hooks for directories (#6034)
- 2026-07-18 [f0785391](https://github.com/filebrowser/filebrowser/commit/f0785391bf11cc8ec53bff7b2f36a29a02f536dc) — chore: update translations (#6019)
- 2026-07-18 [ac46cf06](https://github.com/filebrowser/filebrowser/commit/ac46cf06719575477d5125e7472037c204b3702d) — fix: return error instead of panicking on an unreadable directory during copy (#6020)
- 2026-07-21 [b7dc3928](https://github.com/filebrowser/filebrowser/commit/b7dc392838f11d188f0bc0f2a1a99fad3f7dca03) — docs: fix typo
- 2026-07-25 [c05c6681](https://github.com/filebrowser/filebrowser/commit/c05c66814891c3cccef394162e428444b53394e4) — fix: process --FollowExternalSymlinks
- 2026-07-25 [7361d91e](https://github.com/filebrowser/filebrowser/commit/7361d91ea2e8cc200a0f40ac84adcd02aedc9ed2) — fix(upload): handle encoded path conflicts safely (#6040)
- 2026-07-25 [b21b1245](https://github.com/filebrowser/filebrowser/commit/b21b1245ae1b57f031b2f5d787f32a17532402c0) — fix: accessibility and security improvements (#6033)
- 2026-07-25 [6232686e](https://github.com/filebrowser/filebrowser/commit/6232686e222eae9e627c8c432e3e1d6796782971) — chore: update translations
- 2026-07-25 [5a12cad5](https://github.com/filebrowser/filebrowser/commit/5a12cad54855b6bb3189f0d5ea93942647989ba5) — docs: update readme
- 2026-07-25 [9fffee38](https://github.com/filebrowser/filebrowser/commit/9fffee387ff102728e47531ebc6cf5d1dd39bbf1) — docs: remove go report
- 2026-07-25 [8ddd3d1d](https://github.com/filebrowser/filebrowser/commit/8ddd3d1db9b9f5727d0bf96ea0e7d9a25a8692b4) — fix(auth): isolate auto-provisioned proxy and hook users to their own home
- 2026-07-25 [4b8a8d72](https://github.com/filebrowser/filebrowser/commit/4b8a8d72ce554dde378b5091da74aa930ea18327) — fix(storage): reject case-folded home directory collisions
- 2026-07-25 [6c69b5cd](https://github.com/filebrowser/filebrowser/commit/6c69b5cd895e15b29e563200a9a6dfc27b06525e) — fix(http): enforce download permission on the checksum branch
- 2026-07-25 [9bd79c3a](https://github.com/filebrowser/filebrowser/commit/9bd79c3aaeb4a55b0e69cf8976c4a258db2f5e06) — fix(http): delete abandoned TUS uploads through the scoped filesystem
- 2026-07-25 [4daddec6](https://github.com/filebrowser/filebrowser/commit/4daddec6f200b03a721197d8c0b4b652c994894e) — fix(http): enforce declared Upload-Length on TUS uploads
- 2026-07-25 [cd5749df](https://github.com/filebrowser/filebrowser/commit/cd5749dff8bbc2c16f99b7a127651a9d8e0da694) — test(auth): cover per-user scope isolation for proxy and hook provisioning
- 2026-07-25 [7453c78c](https://github.com/filebrowser/filebrowser/commit/7453c78c9877cbee71dfbad06326d450102e59de) — test(storage): cover case-insensitive GetByScope matching
- 2026-07-25 [610e0b09](https://github.com/filebrowser/filebrowser/commit/610e0b09e93e4b1940b9d50c9b0374ccab02a0d5) — test(http): cover download-permission gate on the checksum branch
- 2026-07-25 [3213b605](https://github.com/filebrowser/filebrowser/commit/3213b605be4f8f9938b093a3384d404d66e7a28b) — test(http): cover scope-safe removal on TUS upload eviction
- 2026-07-25 [4c3cb4bc](https://github.com/filebrowser/filebrowser/commit/4c3cb4bc9b7a165ef42cf79f0e0842bbc42e26fd) — test(http): cover TUS Upload-Length enforcement
- 2026-07-25 [328f6291](https://github.com/filebrowser/filebrowser/commit/328f629181888760f3c8b3ff9f3b5bec50f4e54f) — chore(release): 2.63.19
- 2026-07-25 [392253c5](https://github.com/filebrowser/filebrowser/commit/392253c5636c8e9a1d4d0d46c94c70b8134187c6) — docs: update SECURITY.md and add CLAUDE.md
- 2026-07-25 [660d8466](https://github.com/filebrowser/filebrowser/commit/660d84661d32b271a037e4af25856833d49dca99) — docs: update CLAUDE.md
- 2026-07-25 [4a4b0f8c](https://github.com/filebrowser/filebrowser/commit/4a4b0f8c840f1f83be09495d54d964da5c52f5e1) — docs: update CLAUDE instructions
- 2026-07-25 [67e893ee](https://github.com/filebrowser/filebrowser/commit/67e893eee7ee411e166d3fcd759a87b6f0971277) — fix: use aria-selected
- 2026-07-25 [fb6aeba9](https://github.com/filebrowser/filebrowser/commit/fb6aeba9eae7b8eb401e0db325973781e1ffd08b) — fix(users): make the provisioned scope check atomic with the save
- 2026-07-25 [bc3d75a9](https://github.com/filebrowser/filebrowser/commit/bc3d75a94a4b921fb24e2ebc231fb35e4e14064f) — test(users): cover concurrent provisioning into one scope
- 2026-07-25 [50125a5d](https://github.com/filebrowser/filebrowser/commit/50125a5d21c9f5e9a78db80d77a26139614ce72e) — chore(release): 2.63.20
- 2026-07-26 [032271ba](https://github.com/filebrowser/filebrowser/commit/032271bafab16b6d36236c46ac0d832f60e0f435) — chore(deps): update all non-major dependencies (#5946)
- 2026-07-26 [0dd89058](https://github.com/filebrowser/filebrowser/commit/0dd89058867f87a7bc04aa7517d21528a280e27c) — Revert "chore(deps): update all non-major dependencies (#5946)"
- 2026-07-26 [41b01a74](https://github.com/filebrowser/filebrowser/commit/41b01a7404c1a278284a03bf6f3b56ce440b997a) — chore: update Go deps
- 2026-07-26 [41e2b1bb](https://github.com/filebrowser/filebrowser/commit/41e2b1bbbae47e12cedb684f49964df77fe710c7) — docs: update CLAUDE.md
- 2026-07-26 [e6d70cf2](https://github.com/filebrowser/filebrowser/commit/e6d70cf24c0cd79a1787601dc99104ec7e7ca3ef) — fix(http): canonicalize paths before checking access rules (#6045)
- 2026-07-26 [f6fb8f6b](https://github.com/filebrowser/filebrowser/commit/f6fb8f6bf52d714b2215534033a3c96316069efc) — chore(release): 2.63.21
- 2026-07-26 [ac11538f](https://github.com/filebrowser/filebrowser/commit/ac11538f08235d5a27438ca21fed90fee3b80c80) — chore: update renovate.json
- 2026-07-27 [91e68edb](https://github.com/filebrowser/filebrowser/commit/91e68edb8c4e4362440eac66fbe71d2688b156d8) — chore(deps): update dependency dompurify to v3.4.12 [security] (#6046)
- 2026-07-27 [b24e43b0](https://github.com/filebrowser/filebrowser/commit/b24e43b06c8a5d59d606eea9017da657356fe318) — chore: fix renovate.json order
- 2026-07-27 [9dd7c7d0](https://github.com/filebrowser/filebrowser/commit/9dd7c7d099ff892c88029bbb0f6d0b449cacee6b) — chore(deps): update dependency postcss to v8.5.18 [security] (#6047)
- 2026-07-27 [0b925cbc](https://github.com/filebrowser/filebrowser/commit/0b925cbca940fe0b2726827cf66783da05c64f5e) — fix: unblock stalled and frozen uploads
- 2026-07-27 [773b3010](https://github.com/filebrowser/filebrowser/commit/773b30102c90cb7ccf37120e423ccf80ac8633f6) — docs: add wind down notice
- 2026-07-27 [74b13db3](https://github.com/filebrowser/filebrowser/commit/74b13db3fa3e0bb8665ac851c0f0e17e11671f9d) — docs: fix date
- 2026-07-27 [a789f29c](https://github.com/filebrowser/filebrowser/commit/a789f29ceec4734e7471592921d1ce67f1a10a7e) — fix: make the sidebar scrollable when content overflows (#6031)
- 2026-07-27 [72faf6dd](https://github.com/filebrowser/filebrowser/commit/72faf6dd3c85628e332d3e567124b86708ce2695) — fix: enforce rules on recursive operations and expired proxy tokens (#6053)
- 2026-07-27 [cfff8430](https://github.com/filebrowser/filebrowser/commit/cfff84306af66deedfdc9248300919b3ddd9a7f0) — fix: use absolute URLs for the PWA manifest icon sources (#6032)
- 2026-07-27 [d49ab679](https://github.com/filebrowser/filebrowser/commit/d49ab67904b3f5e363cac01cb0da8ed8d34c3889) — chore: update translations
- 2026-07-27 [df286999](https://github.com/filebrowser/filebrowser/commit/df2869993aed240b815aed56b33ecbd2bbc6216b) — chore: remove renovate.json
- 2026-07-27 [afeb478e](https://github.com/filebrowser/filebrowser/commit/afeb478ee1b9d6800d438891d7d56e69204b81f4) — chore(release): 2.63.22
- 2026-07-27 [05ee853e](https://github.com/filebrowser/filebrowser/commit/05ee853eefd356128849c667081665f9ce05c85e) — docs: clear inconsistencies, point at repo instead of website
- 2026-07-27 [0dfe4464](https://github.com/filebrowser/filebrowser/commit/0dfe44649c79deeeaa449041440a277656f1dfc6) — docs: cleanup header
- 2026-07-27 [e8a388f8](https://github.com/filebrowser/filebrowser/commit/e8a388f840173580116f2743813d03b22286e44e) — chore(release): 2.63.23
- 2026-07-27 [1cd18d7e](https://github.com/filebrowser/filebrowser/commit/1cd18d7ead4ae843025daa77ca7850e428563447) — docs: include issue summary in readme
- 2026-07-28 [833d9088](https://github.com/filebrowser/filebrowser/commit/833d908884d5c801f30f5c098d7977177eb3a36b) — docs: update post link
