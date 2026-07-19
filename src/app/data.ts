export type Article = {
  id: string;
  title: string;
  source: string;
  sourceIcon: string;
  author: string;
  date: string;
  dateMs?: number;
  readTime: string;
  preview: string;
  content: string;
  image?: string;
  starred: boolean;
  read: boolean;
  category: string;
  tags?: string[];
  link?: string;
  lang?: string;            // "fa" | "ar" | "other" (server-detected)
  titleOriginal?: string;   // original headline before Persian translation
  titleTranslated?: boolean; // true when `title` was AI-translated to Persian
};

export const feeds = [
  { id: 'zoomit', name: 'زومیت', count: 23, icon: '🔷', category: 'فناوری' },
  { id: 'digiato', name: 'دیجیاتو', count: 15, icon: '🟣', category: 'فناوری' },
  { id: 'bbc', name: 'بی‌بی‌سی فارسی', count: 42, icon: '🔴', category: 'اخبار' },
  { id: 'varzesh3', name: 'ورزش سه', count: 8, icon: '🟢', category: 'ورزش' },
  { id: 'tarjomaan', name: 'ترجمان', count: 5, icon: '🟡', category: 'فرهنگ' },
  { id: 'shargh', name: 'روزنامه شرق', count: 12, icon: '⚫', category: 'اخبار' },
  { id: 'hamshahri', name: 'همشهری آنلاین', count: 7, icon: '🔵', category: 'اخبار' },
  { id: 'virgool', name: 'ویرگول', count: 31, icon: '🟠', category: 'وبلاگ' },
];

export const categories = [
  { id: 'tech', name: 'فناوری', count: 38, color: 'bg-blue-500' },
  { id: 'news', name: 'اخبار', count: 61, color: 'bg-red-500' },
  { id: 'sport', name: 'ورزش', count: 8, color: 'bg-green-500' },
  { id: 'culture', name: 'فرهنگ و هنر', count: 5, color: 'bg-yellow-500' },
  { id: 'blog', name: 'وبلاگ‌ها', count: 31, color: 'bg-orange-500' },
];

export const articles: Article[] = [
  {
    id: '1',
    title: 'هوش مصنوعی جدید کلود ۴.۷ با قابلیت‌های پیشرفته معرفی شد',
    source: 'زومیت',
    sourceIcon: '🔷',
    author: 'علی محمدی',
    date: '۲ ساعت پیش',
    readTime: '۵ دقیقه',
    preview: 'شرکت آنتروپیک نسخه جدید مدل هوش مصنوعی کلود را با بهبودهای قابل توجه در استدلال و برنامه‌نویسی عرضه کرد. این مدل توانایی پردازش اطلاعات پیچیده‌تر را دارد.',
    content: 'شرکت آنتروپیک امروز از نسخه جدید مدل هوش مصنوعی خود با نام کلود ۴.۷ رونمایی کرد. این مدل جدید در مقایسه با نسخه‌های پیشین بهبود چشمگیری در توانایی استدلال، برنامه‌نویسی و درک زبان طبیعی نشان می‌دهد.\n\nبر اساس گزارش‌های منتشرشده، کلود ۴.۷ در آزمون‌های استاندارد برنامه‌نویسی امتیاز بالاتری نسبت به رقبای خود کسب کرده است. این مدل همچنین قادر به پردازش اسناد طولانی‌تر و پاسخگویی به سوالات پیچیده با دقت بیشتر است.\n\nاز ویژگی‌های برجسته این نسخه می‌توان به بهبود حافظه بلندمدت، توانایی تحلیل تصاویر با جزئیات بیشتر و پشتیبانی بهتر از زبان‌های غیر انگلیسی از جمله فارسی اشاره کرد.',
    image: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800',
    starred: true,
    read: false,
    category: 'tech',
  },
  {
    id: '2',
    title: 'رونمایی از گوشی جدید سامسونگ با دوربین ۲۰۰ مگاپیکسلی',
    source: 'دیجیاتو',
    sourceIcon: '🟣',
    author: 'سارا احمدی',
    date: '۴ ساعت پیش',
    readTime: '۷ دقیقه',
    preview: 'سامسونگ از جدیدترین پرچمدار خود با قابلیت‌های عکاسی حرفه‌ای و باتری پرظرفیت رونمایی کرد. این گوشی با قیمت رقابتی عرضه خواهد شد.',
    content: 'سامسونگ در یک رویداد ویژه از گوشی جدید خود رونمایی کرد. این گوشی با دوربین اصلی ۲۰۰ مگاپیکسلی و باتری ۵۰۰۰ میلی‌آمپری عرضه می‌شود.',
    image: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=800',
    starred: false,
    read: false,
    category: 'tech',
  },
  {
    id: '3',
    title: 'پیروزی تیم ملی فوتبال ایران در دیدار دوستانه',
    source: 'ورزش سه',
    sourceIcon: '🟢',
    author: 'رضا کریمی',
    date: '۶ ساعت پیش',
    readTime: '۳ دقیقه',
    preview: 'تیم ملی فوتبال ایران در دیدار دوستانه خود با نتیجه ۳ بر ۱ به پیروزی رسید. این بازی مقدمه‌ای برای جام ملت‌های آسیا محسوب می‌شود.',
    content: 'تیم ملی فوتبال ایران در دیداری دوستانه موفق شد با نتیجه ۳ بر ۱ حریف خود را شکست دهد. گل‌های این بازی در دقایق ۲۳، ۵۴ و ۷۸ به ثمر رسید.',
    image: 'https://images.unsplash.com/photo-1551958219-acbc608c6377?w=800',
    starred: false,
    read: true,
    category: 'sport',
  },
  {
    id: '4',
    title: 'آخرین تحولات اقتصادی و بازار ارز در هفته گذشته',
    source: 'بی‌بی‌سی فارسی',
    sourceIcon: '🔴',
    author: 'مریم رضایی',
    date: '۸ ساعت پیش',
    readTime: '۱۰ دقیقه',
    preview: 'بررسی جامع تحولات اقتصادی هفته گذشته و تاثیر آن بر بازارهای مالی داخلی و خارجی. نوسانات ارزی همچنان ادامه دارد.',
    content: 'در هفته گذشته شاهد تحولات متعددی در بازارهای مالی بودیم. قیمت ارز و طلا در این هفته نوسانات قابل توجهی را تجربه کرد.',
    image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800',
    starred: true,
    read: false,
    category: 'news',
  },
  {
    id: '5',
    title: 'نقد و بررسی فیلم جدید اصغر فرهادی در جشنواره کن',
    source: 'ترجمان',
    sourceIcon: '🟡',
    author: 'نیما شریفی',
    date: '۱ روز پیش',
    readTime: '۱۲ دقیقه',
    preview: 'فیلم جدید کارگردان برجسته ایرانی در جشنواره کن با استقبال منتقدان مواجه شد. این اثر روایتی متفاوت از زندگی مدرن ارائه می‌دهد.',
    content: 'فیلم جدید اصغر فرهادی در جشنواره فیلم کن به نمایش درآمد و با تحسین منتقدان روبرو شد.',
    image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800',
    starred: false,
    read: false,
    category: 'culture',
  },
  {
    id: '6',
    title: 'راهکارهای افزایش بهره‌وری در محیط کار از راه دور',
    source: 'ویرگول',
    sourceIcon: '🟠',
    author: 'حسین موسوی',
    date: '۱ روز پیش',
    readTime: '۸ دقیقه',
    preview: 'چگونه در محیط کار از راه دور بهره‌وری خود را افزایش دهیم؟ این مقاله به بررسی روش‌های عملی و اثبات‌شده می‌پردازد.',
    content: 'کار از راه دور به بخش جدایی‌ناپذیری از زندگی حرفه‌ای بسیاری از افراد تبدیل شده است.',
    image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800',
    starred: false,
    read: false,
    category: 'blog',
  },
  {
    id: '7',
    title: 'کشف گونه جدیدی از ماهی در اعماق اقیانوس آرام',
    source: 'همشهری آنلاین',
    sourceIcon: '🔵',
    author: 'دکتر احمد نوری',
    date: '۲ روز پیش',
    readTime: '۶ دقیقه',
    preview: 'محققان گونه جدیدی از ماهی را در اعماق اقیانوس آرام کشف کردند که ویژگی‌های منحصربه‌فردی دارد.',
    content: 'تیمی از محققان در اعماق اقیانوس آرام موفق به کشف گونه جدیدی از ماهی شدند.',
    image: 'https://images.unsplash.com/photo-1518399681705-1c1a55e5e883?w=800',
    starred: true,
    read: true,
    category: 'news',
  },
  {
    id: '8',
    title: 'معرفی ۱۰ کتاب برتر سال ۱۴۰۴ از نگاه منتقدان',
    source: 'روزنامه شرق',
    sourceIcon: '⚫',
    author: 'فاطمه حسینی',
    date: '۲ روز پیش',
    readTime: '۱۵ دقیقه',
    preview: 'فهرستی از بهترین کتاب‌های منتشر شده در سال جاری که توسط منتقدان برجسته ادبی انتخاب شده‌اند.',
    content: 'سال ۱۴۰۴ سال پرباری برای ادبیات فارسی بود. در این گزارش به معرفی ۱۰ کتاب برتر می‌پردازیم.',
    image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800',
    starred: false,
    read: false,
    category: 'culture',
  },
];
