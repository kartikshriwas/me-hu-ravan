import { notFound } from 'next/navigation';
import { getCourseBySlug, parseRawCourseData } from '@/lib/coursesData';
import { getAllAssessments } from '@/lib/questionsData';
import { cookies } from 'next/headers';
import { auth } from '@/auth';
import { hasCoursesAccess, isCourseSlugUnlocked } from '@/lib/coursesAuth';
import { CourseDetailClient } from '@/components/CourseDetailClient';

const DEFAULT_APNA_COOKIE = '_fw_crm_v=d6673cee-8e3f-422c-a305-fed2a34b3815; first_session=%7B%22visits%22%3A273%2C%22start%22%3A1786438089874%2C%22last_visit%22%3A1790924879106%2C%22url%22%3A%22https%3A%2F%2Fwww.apnacollege.in%2F%3Fmsg%3Dnot-logged-in%22%2C%22path%22%3A%22%2F%22%2C%22referrer%22%3A%22%22%2C%22referrer_info%22%3A%7B%22host%22%3A%22%22%2C%22path%22%3A%22blank%22%2C%22protocol%22%3A%22about%3A%22%2C%22port%22%3A80%2C%22search%22%3A%22%22%2C%22query%22%3A%7B%7D%7D%2C%22search%22%3A%7B%22engine%22%3Anull%2C%22query%22%3Anull%7D%2C%22prev_visit%22%3A1790924848262%2C%22time_since_last_visit%22%3A30844%2C%22version%22%3A0.4%7D; _ga_VPHPY6NJ60=GS2.1.s1786549035$o1$g0$t1786549837$j60$l0$h0; _ga=GA1.1.1082126793.1786549036; _gcl_au=1.1.1513693125.1786549040; _ga_Y246J8EW3H=GS2.1.s1786549043$o1$g0$t1786549726$j60$l0$h2110132126; _fbp=fb.1.1786549045799.478526603980150363; _cfuvid=QoDATMs1pqXFYESur3ovipbbBGTtChtFDRZXTbfrZiM-1790923236.2667675-1.0.1.1-olXmT657a7ZGZEb4TBwdz7zh9UGHx0XR7WWdovGEXq8; slim_session=cARLhRsb9b2IOoVxMBLbLMTmTeYqUisQVN5tXqkr; lw_tokens=%7B%22access_token%22%3A%22dbFvjFogomoP0dbUiX9MtqR5DvVTgDm64t3EINGH%22%2C%22token_type%22%3A%22Bearer%22%2C%22expires_in%22%3A604800%2C%22refresh_token%22%3A%22z3DM2rcddTbIDplg9tlvepFmXUppXIwrPViy4ivY%22%7D';
const DEFAULT_APNA_AUTH = 'Bearer dbFvjFogomoP0dbUiX9MtqR5DvVTgDm64t3EINGH';

// Fetch course data from external API with fallback to local DB
async function fetchCourseFromApi(slug: string) {
  try {
    let cookieHeader = process.env.APNA_COLLEGE_COOKIE || DEFAULT_APNA_COOKIE;
    let authHeader = process.env.APNA_COLLEGE_AUTH || DEFAULT_APNA_AUTH;

    // Check if client passed custom cookies
    try {
      const cookieStore = await cookies();
      const lwCookie = cookieStore.get('lw_tokens');
      if (lwCookie?.value) {
        const tokenObj = JSON.parse(lwCookie.value);
        if (tokenObj.access_token) {
          authHeader = `Bearer ${tokenObj.access_token}`;
        }
        const userCookies = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');
        if (userCookies) {
          cookieHeader = userCookies;
        }
      }
    } catch {}

    const res = await fetch(`https://www.apnacollege.in/api/course/${slug}?contents=`, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:156.0) Gecko/20100101 Firefox/156.0',
        'Accept': 'application/json, text/plain, */*',
        'Cookie': cookieHeader,
        'Authorization': authHeader
      }
    });

    if (!res.ok) {
      console.warn(`External API returned status ${res.status} for ${slug}`);
      return null;
    }

    const text = await res.text();
    if (!text || text.trim().startsWith('<')) {
      console.warn(`External API returned HTML instead of JSON for ${slug}`);
      return null;
    }

    const data = JSON.parse(text);
    const parsedCourse = parseRawCourseData(data, slug);
    if (parsedCourse && parsedCourse.sections && parsedCourse.sections.length > 0) {
      return parsedCourse;
    }
    return null;
  } catch (e) {
    console.error('Failed to fetch external course data:', e);
    return null;
  }
}

export const revalidate = 0;

export default async function CourseDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const session = await auth();
  const sessionUser = session?.user as any;

  const allowed = await hasCoursesAccess(sessionUser);
  if (!allowed) {
    notFound();
  }

  const { slug } = await params;
  let course = getCourseBySlug(slug);
  
  if (!course) {
    course = await fetchCourseFromApi(slug);
  }

  const availableTests = getAllAssessments();

  if (!course) {
    notFound();
  }

  const isUnlocked = await isCourseSlugUnlocked(sessionUser, slug);

  return (
    <main className="w-full px-4 sm:px-8 lg:px-12 py-6">
      <CourseDetailClient course={course} availableTests={availableTests} isUnlocked={isUnlocked} />
    </main>
  );
}
