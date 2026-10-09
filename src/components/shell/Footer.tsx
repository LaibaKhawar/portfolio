import { profile } from "@/content/profile";

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-10 text-sm text-fg-faint sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
        <p>
          {profile.name}, {profile.location}
        </p>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          <li>
            <a className="hover:text-fg" href={`mailto:${profile.email}`}>
              Email
            </a>
          </li>
          <li>
            <a className="hover:text-fg" href={profile.linkedin} target="_blank" rel="noreferrer">
              LinkedIn
            </a>
          </li>
          <li>
            <a className="hover:text-fg" href={profile.github} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </li>
          <li>
            <a className="hover:text-fg" href={profile.resume} target="_blank" rel="noreferrer">
              Resume (PDF)
            </a>
          </li>
        </ul>
      </div>
    </footer>
  );
}
