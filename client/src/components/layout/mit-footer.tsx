import React from "react";
import { Link } from "wouter";
import { Github, Twitter, Linkedin, Mail } from "lucide-react";

export function MITFooter() {
  return (
    <footer className="bg-mit-light-gray border-t border-mit-silver-gray/20">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Column 1: About */}
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-4">About</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/about">
                  <a className="text-sm text-gray-600 hover:text-mit-red">About Us</a>
                </Link>
              </li>
              <li>
                <Link href="/contact">
                  <a className="text-sm text-gray-600 hover:text-mit-red">Contact</a>
                </Link>
              </li>
              <li>
                <Link href="/privacy">
                  <a className="text-sm text-gray-600 hover:text-mit-red">Privacy Policy</a>
                </Link>
              </li>
              <li>
                <Link href="/terms">
                  <a className="text-sm text-gray-600 hover:text-mit-red">Terms of Service</a>
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Resources */}
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-4">Resources</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/help">
                  <a className="text-sm text-gray-600 hover:text-mit-red">Help Center</a>
                </Link>
              </li>
              <li>
                <Link href="/documentation">
                  <a className="text-sm text-gray-600 hover:text-mit-red">Documentation</a>
                </Link>
              </li>
              <li>
                <Link href="/rubric-guidelines">
                  <a className="text-sm text-gray-600 hover:text-mit-red">Rubric Guidelines</a>
                </Link>
              </li>
              <li>
                <Link href="/api-reference">
                  <a className="text-sm text-gray-600 hover:text-mit-red">API Reference</a>
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Community */}
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-4">Community</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/blog">
                  <a className="text-sm text-gray-600 hover:text-mit-red">Blog</a>
                </Link>
              </li>
              <li>
                <Link href="/forums">
                  <a className="text-sm text-gray-600 hover:text-mit-red">Forums</a>
                </Link>
              </li>
              <li>
                <Link href="/events">
                  <a className="text-sm text-gray-600 hover:text-mit-red">Events</a>
                </Link>
              </li>
              <li>
                <Link href="/showcase">
                  <a className="text-sm text-gray-600 hover:text-mit-red">Showcase</a>
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Connect */}
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-4">Connect</h3>
            <div className="flex space-x-4 mb-4">
              <a href="#" className="text-gray-500 hover:text-mit-red">
                <span className="sr-only">GitHub</span>
                <Github className="h-5 w-5" />
              </a>
              <a href="#" className="text-gray-500 hover:text-mit-red">
                <span className="sr-only">Twitter</span>
                <Twitter className="h-5 w-5" />
              </a>
              <a href="#" className="text-gray-500 hover:text-mit-red">
                <span className="sr-only">LinkedIn</span>
                <Linkedin className="h-5 w-5" />
              </a>
              <a href="#" className="text-gray-500 hover:text-mit-red">
                <span className="sr-only">Email</span>
                <Mail className="h-5 w-5" />
              </a>
            </div>
            <p className="text-sm text-gray-600">
              Stay updated with our newsletter
            </p>
            <div className="mt-2 flex">
              <input
                type="email"
                placeholder="Enter your email"
                className="min-w-0 flex-1 bg-white border border-gray-300 rounded-l-md py-2 px-3 text-sm"
              />
              <button
                type="button"
                className="bg-mit-red text-white rounded-r-md px-4 py-2 text-sm font-medium hover:bg-[#5A0010] transition-colors duration-200"
              >
                Subscribe
              </button>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-mit-silver-gray/20">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <img src="/AcademusLogo.webp" alt="Academus Logo" className="h-8 mr-2" />
              <span className="text-black font-bold text-xl">
                Academus
              </span>
            </div>
            <p className="text-sm text-gray-600">
              &copy; {new Date().getFullYear()} Academus. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}