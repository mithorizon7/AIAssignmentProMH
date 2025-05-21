import React, { useState } from "react";
import { Link } from "wouter";
import { Github, Twitter, Linkedin, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { API_ROUTES } from "@/lib/constants";

export function MITFooter() {
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  const handleSubscribe = async () => {
    try {
      const res = await apiRequest('POST', API_ROUTES.NEWSLETTER_SUBSCRIBE, { email });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      toast({
        title: "Subscribed",
        description: "You've been added to the newsletter",
      });
      setEmail("");
    } catch (error) {
      console.error('Newsletter subscription failed:', error);
      toast({
        title: "Subscription failed",
        description: "Unable to subscribe. Please try again later.",
        variant: "destructive",
      });
    }
  };

  return (
    <footer className="bg-mit-light-gray border-t border-mit-silver-gray/20">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Column 1: About */}
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-4">About</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/about" className="text-sm text-gray-600 hover:text-mit-red">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-gray-600 hover:text-mit-red">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-sm text-gray-600 hover:text-mit-red">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm text-gray-600 hover:text-mit-red">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 2: Resources */}
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-4">Resources</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/help" className="text-sm text-gray-600 hover:text-mit-red">
                  Help Center
                </Link>
              </li>
              <li>
                <Link href="/documentation" className="text-sm text-gray-600 hover:text-mit-red">
                  Documentation
                </Link>
              </li>
              <li>
                <Link href="/rubric-guidelines" className="text-sm text-gray-600 hover:text-mit-red">
                  Rubric Guidelines
                </Link>
              </li>
              <li>
                <Link href="/api-reference" className="text-sm text-gray-600 hover:text-mit-red">
                  API Reference
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Community */}
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-4">Community</h3>
            <ul className="space-y-3">
              <li>
                <Link href="/blog" className="text-sm text-gray-600 hover:text-mit-red">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/forums" className="text-sm text-gray-600 hover:text-mit-red">
                  Forums
                </Link>
              </li>
              <li>
                <Link href="/events" className="text-sm text-gray-600 hover:text-mit-red">
                  Events
                </Link>
              </li>
              <li>
                <Link href="/showcase" className="text-sm text-gray-600 hover:text-mit-red">
                  Showcase
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-w-0 flex-1 bg-white border border-gray-300 rounded-l-md py-2 px-3 text-sm"
              />
              <button
                type="button"
                onClick={handleSubscribe}
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
              <img src="/AcademusLogo.webp" alt="Academus Logo" className="h-10 mr-1.5" />
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