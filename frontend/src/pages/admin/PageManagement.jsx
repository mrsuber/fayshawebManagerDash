import React, { useState } from 'react';
import { PageEditorProvider } from '../../contexts/PageEditorContext';
import VisualPageEditor from '../../components/VisualPageEditor';
import '../../site/site.css';
import Home from '../../site/pages/Home';
import About from '../../site/pages/About';
import Wellness from '../../site/pages/Wellness';
import Contact from '../../site/pages/Contact';
import Residences from '../../site/pages/Residences';
import Careers from '../../site/pages/Careers';
import Feedback from '../../site/pages/Feedback';

const stayInEditor = (e) => {
  if (e.type === 'submit' || e.target.closest('a[href]')) e.preventDefault();
};

const PageManagement = () => {
  const [selectedPage, setSelectedPage] = useState(null);

  const pages = [
    {
      id: 'home',
      name: 'Home Page',
      icon: '🏠',
      description: 'Main landing page with hero section, features, and property showcase',
      component: Home
    },
    {
      id: 'about',
      name: 'About Page',
      icon: '📖',
      description: 'About Faysha, company history, and mission statement',
      component: About
    },
    {
      id: 'amenities',
      name: 'Wellness Page',
      icon: '✨',
      description: 'The four moods, their sessions and wellness journeys',
      component: Wellness
    },
    {
      id: 'contact',
      name: 'Contact Page',
      icon: '📧',
      description: 'Contact information and inquiry form',
      component: Contact
    },
    {
      id: 'booking',
      name: 'Residences Page',
      icon: '📅',
      description: 'Residence search and availability',
      component: Residences
    },
    {
      id: 'careers',
      name: 'Careers Page',
      icon: '💼',
      description: 'Job listings and career opportunities',
      component: Careers
    },
    {
      id: 'feedback',
      name: 'Feedback Page',
      icon: '⭐',
      description: 'Guest feedback and testimonial form',
      component: Feedback
    }
  ];

  if (selectedPage) {
    const pageConfig = pages.find(p => p.id === selectedPage);
    const PageComponent = pageConfig.component;

    return (
      <PageEditorProvider>
        <div className="fixed inset-0 z-50 bg-white overflow-auto">
          {/* Back Button */}
          <div className="absolute top-4 left-4 z-50">
            <button
              onClick={() => setSelectedPage(null)}
              className="flex items-center space-x-2 bg-white hover:bg-gray-50 text-gray-700 font-medium px-4 py-2 rounded-lg shadow-md border border-gray-200 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Pages</span>
            </button>
          </div>

          {/* Visual Editor */}
          <VisualPageEditor pageId={selectedPage}>
            {/* The site's own styles; links and forms in the preview are inert so editing never leaves the editor. */}
            <div className="fs" onClickCapture={stayInEditor} onSubmitCapture={stayInEditor}>
              <PageComponent />
            </div>
          </VisualPageEditor>
        </div>
      </PageEditorProvider>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-heading text-dark-900 mb-2">Page Management</h2>
        <p className="text-gray-600">
          Select a page to edit its content using the visual editor. You can edit text inline and switch between languages.
        </p>
      </div>

      {/* Page Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pages.map((page) => (
          <button
            key={page.id}
            onClick={() => setSelectedPage(page.id)}
            className="text-left bg-white rounded-xl shadow-soft border border-gray-100 hover:border-primary-200 hover:shadow-gold transition-all duration-300 p-6 group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-14 h-14 bg-primary-50 rounded-xl flex items-center justify-center text-3xl group-hover:bg-primary-100 transition-colors">
                {page.icon}
              </div>
              <div className="bg-primary-500 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
            </div>

            <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors">
              {page.name}
            </h3>
            <p className="text-sm text-gray-600">
              {page.description}
            </p>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center text-sm text-primary-600 font-medium">
                <span>Edit Page</span>
                <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Info Box */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h4 className="text-lg font-semibold text-blue-900 mb-2">How to use the Visual Editor</h4>
            <ul className="text-sm text-blue-800 space-y-2">
              <li className="flex items-start">
                <svg className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Click on any page card above to open it in the visual editor</span>
              </li>
              <li className="flex items-start">
                <svg className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Use the language toggle to switch between English and French</span>
              </li>
              <li className="flex items-start">
                <svg className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Click "Enable Editing" to see edit icons next to each text element</span>
              </li>
              <li className="flex items-start">
                <svg className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Hover over any text and click the pencil icon to edit it inline</span>
              </li>
              <li className="flex items-start">
                <svg className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Click "Save Changes" to update the content in the database</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PageManagement;
