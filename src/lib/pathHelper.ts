import path from 'path';

export function getCoursesDirectory(): string {
  return path.resolve(process.cwd(), './Courses');
}

export function getQuestionsDirectory(): string {
  return path.resolve(process.cwd(), './Courses/Questions');
}
