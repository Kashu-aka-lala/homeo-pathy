"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";

export default function LandingPage() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileNavActive, setIsMobileNavActive] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const faqAnswerRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const CLINIC_CONFIG = {
    phone: '+923000000000',
    whatsapp: '923000000000',
    defaultMessage: 'Hi Yashfeen Homeopathy, I would like to inquire about a consultation.',
  };

  const whatsappUrl = `https://wa.me/${CLINIC_CONFIG.whatsapp}?text=${encodeURIComponent(CLINIC_CONFIG.defaultMessage)}`;
  const formattedPhone = '+92 (300) 000-0000'; // Hardcoded per index.html

  useEffect(() => {
    const savedTheme = localStorage.getItem('yashfeen_theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
      setIsDarkMode(true);
      document.body.classList.add('dark-mode');
      document.body.classList.remove('light-mode');
    } else {
      setIsDarkMode(false);
      document.body.classList.add('light-mode');
      document.body.classList.remove('dark-mode');
    }

    const revealElements = document.querySelectorAll('.scroll-reveal');
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });
    revealElements.forEach(el => revealObserver.observe(el));

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);

      const sections = document.querySelectorAll('section');
      let currentSectionId = '';
      sections.forEach(section => {
        const sectionTop = section.offsetTop - 120;
        const sectionHeight = section.offsetHeight;
        if (window.scrollY >= sectionTop && window.scrollY < sectionTop + sectionHeight) {
          currentSectionId = section.getAttribute('id') || '';
        }
      });
      setActiveSection(currentSectionId);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleTheme = () => {
    setIsDarkMode(prev => {
      const newVal = !prev;
      if (newVal) {
        document.body.classList.add('dark-mode');
        document.body.classList.remove('light-mode');
        localStorage.setItem('yashfeen_theme', 'dark');
      } else {
        document.body.classList.add('light-mode');
        document.body.classList.remove('dark-mode');
        localStorage.setItem('yashfeen_theme', 'light');
      }
      return newVal;
    });
  };

  const toggleMobileNav = () => setIsMobileNavActive(!isMobileNavActive);
  const closeMobileNav = () => setIsMobileNavActive(false);

  const toggleFaq = (id: string) => {
    setExpandedFaq(expandedFaq === id ? null : id);
  };

  return (
    <>
      <header id="main-header" className={`main-header ${isScrolled ? 'scrolled' : ''}`}>
        <div className="container header-container">
          <Link href="#hero" className="logo" id="logo-link">
            <img src="/assets/logo.jpg" alt="Yashfeen Homeopathy Logo" className="logo-img" id="logo-img" />
            <span className="logo-text">Yashfeen <span className="logo-subtext">Homeopathy</span></span>
          </Link>

          <nav id="desktop-nav" className="desktop-nav">
            <ul>
              <li><Link href="#hero" className={`nav-link ${activeSection === 'hero' ? 'active' : ''}`}>Home</Link></li>
              <li><Link href="#about" className={`nav-link ${activeSection === 'about' ? 'active' : ''}`}>About Clinic</Link></li>
              <li><Link href="#services" className={`nav-link ${activeSection === 'services' ? 'active' : ''}`}>Our Services</Link></li>
              <li><Link href="#info" className={`nav-link ${activeSection === 'info' ? 'active' : ''}`}>Working Hours</Link></li>
              <li><Link href="#faq" className={`nav-link ${activeSection === 'faq' ? 'active' : ''}`}>FAQs</Link></li>
              <li><Link href="/emr" className="nav-link text-primary font-bold">Portal</Link></li>
            </ul>
          </nav>

          <div className="header-actions">
            <button id="theme-toggle" className="theme-toggle" aria-label="Toggle Light/Dark Mode" title="Toggle Light/Dark Mode" onClick={toggleTheme}>
              <svg id="sun-icon" className={`theme-icon ${isDarkMode ? 'hidden' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>
              </svg>
              <svg id="moon-icon" className={`theme-icon ${isDarkMode ? '' : 'hidden'}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
              </svg>
            </button>

            <button id="menu-toggle" className={`menu-toggle ${isMobileNavActive ? 'active' : ''}`} aria-label="Toggle Navigation Menu" onClick={toggleMobileNav}>
              <span className="hamburger"></span>
            </button>
          </div>
        </div>
      </header>

      <div id="mobile-nav-overlay" className={`mobile-nav-overlay ${isMobileNavActive ? 'active' : ''}`}>
        <nav className="mobile-nav">
          <ul>
            <li><Link href="#hero" className="mobile-nav-link" onClick={closeMobileNav}>Home</Link></li>
            <li><Link href="#about" className="mobile-nav-link" onClick={closeMobileNav}>About Clinic</Link></li>
            <li><Link href="#services" className="mobile-nav-link" onClick={closeMobileNav}>Our Services</Link></li>
            <li><Link href="#info" className="mobile-nav-link" onClick={closeMobileNav}>Working Hours</Link></li>
            <li><Link href="#faq" className="mobile-nav-link" onClick={closeMobileNav}>FAQs</Link></li>
            <li><Link href="/emr" className="mobile-nav-link text-primary font-bold">Portal</Link></li>
          </ul>
        </nav>
      </div>

      <section id="hero" className="hero-section">
        <div className="hero-bg-overlay"></div>
        <div className="container hero-container">
          <div className="hero-content">
            <div className="badge fade-in">Holistic Natural Wellness</div>
            <h1 className="fade-in delay-1">Gentle Healing, <br/><span className="text-gradient">Permanent Cure</span></h1>
            <p className="hero-lead fade-in delay-2">At Yashfeen Homeopathy, we address the root causes of chronic and acute health conditions using individualized, natural remedies. Safe for all ages with zero side effects.</p>
            
            <div className="hero-cta-group fade-in delay-3">
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" id="wa-hero-cta">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                Connect on WhatsApp
              </a>
              <Link href="#about" className="btn btn-outline" id="secondary-hero-cta">
                Learn More
              </Link>
            </div>
            
            <div className="hero-stats fade-in delay-4">
              <div className="stat-item">
                <span className="stat-number">15+</span>
                <span className="stat-label">Years of Care</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">98%</span>
                <span className="stat-label">Happy Patients</span>
              </div>
              <div className="stat-item">
                <span className="stat-number">10k+</span>
                <span className="stat-label">Cases Treated</span>
              </div>
            </div>
          </div>
          
          <div className="hero-visual fade-in">
            <div className="visual-card">
              <div className="visual-badge">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
                100% Natural Treatments
              </div>
              <div className="visual-logo-wrapper">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="visual-logo-svg">
                  <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2Z"/>
                  <path d="M12 6c-3 0-4 2-4 4s1 4 4 4 4-2 4-4-1-4-4-4Z"/>
                  <path d="M12 14c-4 0-6 2-6 4v1h12v-1c0-2-2-4-6-4Z"/>
                  <path d="M12 4v2"/>
                  <path d="M12 18v2"/>
                </svg>
              </div>
              <div className="visual-content">
                <h3>Dr. Umar Farooq</h3>
                <p className="visual-subtitle">Senior Homeopathic Consultant</p>
                <div className="visual-tags">
                  <span>BHMS</span>
                  <span>R.H.M.P</span>
                  <span>Chronic Specialist</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="about-section scroll-reveal">
        <div className="container">
          <div className="section-header">
            <span className="section-subtitle">Holistic Health Philosophy</span>
            <h2>Individualized Treatment for Long-term Cure</h2>
            <div className="header-divider"></div>
          </div>
          
          <div className="about-grid">
            <div className="about-info">
              <h3>Welcome to Yashfeen Homeopathy</h3>
              <p>We believe in treating the whole person—mind, body, and spirit—rather than just suppressing isolated symptoms. Our clinic, led by <strong>Dr. Umar Farooq</strong>, provides a welcoming space for patients seeking gentle and effective alternatives for deep-seated illnesses.</p>
              <p>Homeopathy works by stimulating the body&apos;s natural defense systems. By matching the unique profile of your symptoms to custom-prepared botanical, mineral, and biological formulations, we catalyze a natural healing process that addresses root causes.</p>
              
              <ul className="about-bullets">
                <li>
                  <div className="bullet-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  </div>
                  <div><strong>No Side Effects:</strong> Fully safe for infants, pregnant mothers, and elderly patients.</div>
                </li>
                <li>
                  <div className="bullet-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  </div>
                  <div><strong>Root Cause Analysis:</strong> We don&apos;t mask symptoms; we eliminate the underlying source.</div>
                </li>
                <li>
                  <div className="bullet-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  </div>
                  <div><strong>Constitutional Profiling:</strong> Custom remedies tailormade for your mental & physical makeup.</div>
                </li>
              </ul>
            </div>

            <div className="about-cards">
              <div className="about-card feature-1">
                <div className="card-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <h4>Safe & Non-Toxic</h4>
                <p>Prepared in highly diluted micro-doses, our treatments are gentle on the stomach and organic.</p>
              </div>
              <div className="about-card feature-2">
                <div className="card-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>
                  </svg>
                </div>
                <h4>Experienced Doctor</h4>
                <p>Under the guidance of registered experts specializing in complex, chronic autoimmune and lifestyle cases.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="services-section scroll-reveal">
        <div className="container">
          <div className="section-header">
            <span className="section-subtitle">What We Treat</span>
            <h2>Comprehensive Homeopathic Care</h2>
            <div className="header-divider"></div>
            <p className="section-lead-text">We offer tailored natural therapeutic services for a wide spectrum of health challenges, providing support where conventional medicine may fall short.</p>
          </div>

          <div className="services-grid">
            <div className="service-card">
              <div className="service-icon-wrapper">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="service-icon">
                  <path d="M4 14a8 8 0 0 1 16 0V20a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>
                  <path d="M12 2v4M12 6a4 4 0 0 0-4 4M12 6a4 4 0 0 1 4 4"/>
                </svg>
              </div>
              <h3>Chronic Diseases</h3>
              <p>Long-term therapeutic management for Migraine, Asthma, Rheumatoid Arthritis, IBS, Hypertension, and immune-mediated ailments.</p>
              <ul className="service-list">
                <li>Arthritis & Joint Pains</li>
                <li>Allergies & Sinusitis</li>
                <li>Digestive Disorders</li>
              </ul>
            </div>

            <div className="service-card">
              <div className="service-icon-wrapper">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="service-icon">
                  <path d="M12 2a5 5 0 0 0-5 5v3a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5z"/>
                  <path d="M17 16c1.1 0 2-.9 2-2v-2c0-1.1-.9-2-2-2h-1v6h1zM7 16c-1.1 0-2-.9-2-2v-2c0-1.1.9-2 2-2h1v6H7z"/>
                  <path d="M12 18a6 6 0 0 0-6 6h12a6 6 0 0 0-6-6z"/>
                </svg>
              </div>
              <h3>Skin & Hair Treatment</h3>
              <p>Natural healing for complex skin outbreaks and hair loss, restoring dermatological health internally without steroids.</p>
              <ul className="service-list">
                <li>Eczema & Psoriasis</li>
                <li>Acne & Dermatitis</li>
                <li>Alopecia & Dandruff</li>
              </ul>
            </div>

            <div className="service-card">
              <div className="service-icon-wrapper">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="service-icon">
                  <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              </div>
              <h3>Pediatric & Female Care</h3>
              <p>Safe, sweet homeopathic remedies designed specifically for kids&apos; immunity, developmental milestones, and hormonal health in women.</p>
              <ul className="service-list">
                <li>Bedwetting & Hyperactivity</li>
                <li>PCOS & Menstrual Issues</li>
                <li>Thyroid Management</li>
              </ul>
            </div>

            <div className="service-card">
              <div className="service-icon-wrapper">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="service-icon">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <h3>Constitutional Therapy</h3>
              <p>Deep-acting therapeutic analysis designed around your mental state, physical tolerances, genetic history, and daily lifestyle.</p>
              <ul className="service-list">
                <li>Individualized Profiling</li>
                <li>Chronic Resistance Cleansing</li>
                <li>Preventative Wellness</li>
              </ul>
            </div>
          </div>
          
          <div className="cta-banner">
            <div className="cta-banner-content">
              <h3>Need a Consultation?</h3>
              <p>Consult with Dr. Umar Farooq in person at our clinic or schedule a remote voice/video session.</p>
            </div>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn btn-light" id="wa-services-cta">
              Book Appointment
            </a>
          </div>
        </div>
      </section>

      <section id="info" className="info-section scroll-reveal">
        <div className="container">
          <div className="info-grid">
            <div className="info-card hours-card">
              <h3>Working Hours & Contact</h3>
              <div className="info-divider"></div>
              
              <ul className="hours-list">
                <li>
                  <span className="day">Monday - Thursday</span>
                  <span className="time">05:00 PM - 09:00 PM</span>
                </li>
                <li>
                  <span className="day">Friday</span>
                  <span className="time">Closed</span>
                </li>
                <li>
                  <span className="day">Saturday - Sunday</span>
                  <span className="time">11:00 AM - 02:00 PM <br/> 06:00 PM - 09:00 PM</span>
                </li>
              </ul>

              <div className="quick-contacts">
                <div className="contact-item">
                  <div className="contact-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  </div>
                  <div>
                    <span className="contact-label">Phone</span>
                    <a href="tel:+923000000000" className="contact-value" id="phone-link">{formattedPhone}</a>
                  </div>
                </div>
                <div className="contact-item">
                  <div className="contact-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                  </div>
                  <div>
                    <span className="contact-label">Email</span>
                    <a href="mailto:info@yashfeenhomeopathy.online" className="contact-value" id="email-link">info@yashfeenhomeopathy.online</a>
                  </div>
                </div>
              </div>
            </div>

            <div className="info-card location-card">
              <h3>Our Location</h3>
              <div className="info-divider"></div>
              <p className="location-text">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline-location-icon"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                <strong>Yashfeen Homeopathic Clinic</strong><br/>
                Main Clinic Boulevard, Block D, Phase 1,<br/>
                Lahore, Punjab, Pakistan.
              </p>
              
              <div className="map-container">
                <div className="map-placeholder">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="map-placeholder-icon"><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" x2="9" y1="3" y2="18"/><line x1="15" x2="15" y1="6" y2="21"/></svg>
                  <span>Located in Phase 1, Lahore</span>
                  <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer" className="btn btn-xs btn-secondary" id="google-maps-btn">
                    Open in Google Maps
                  </a>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      <section id="faq" className="faq-section scroll-reveal">
        <div className="container">
          <div className="section-header">
            <span className="section-subtitle">Got Questions?</span>
            <h2>Frequently Asked Questions</h2>
            <div className="header-divider"></div>
          </div>

          <div className="faq-accordion-wrapper">
            {[
              {
                id: 'faq1',
                q: 'Is Homeopathy safe for newborn babies and pregnant women?',
                a: 'Yes, absolutely. Homeopathic medicines are prepared through a scientific process of serial dilution and succussion (potentization). Because they are administered in ultra-low doses, they are completely non-toxic and do not cause side effects. This makes them ideal and completely safe for infants, young children, pregnant women, and nursing mothers.'
              },
              {
                id: 'faq2',
                q: 'How long does it take to see results with homeopathic treatments?',
                a: 'The timeline for healing depends entirely on the nature of the condition (acute vs. chronic). Acute illnesses like seasonal flu, colds, or digestive upsets can show significant improvement within hours or days. For chronic, deep-seated autoimmune or lifestyle conditions (e.g., long-standing eczema, asthma, arthritis), the treatment process requires a few months as it aims to correct the underlying systemic imbalance rather than providing quick, temporary suppressive relief.'
              },
              {
                id: 'faq3',
                q: 'Does homeopathy react with conventional allopathic medications?',
                a: 'No, homeopathic medicines do not interfere with conventional allopathic medications. They operate on a completely different physiological mechanism (stimulating vital force and immunological response). However, it is always recommended to inform Dr. Umar Farooq about any other medications you are currently taking so that your overall healing plan can be monitored safely.'
              },
              {
                id: 'faq4',
                q: 'What is "Constitutional Treatment"?',
                a: 'Constitutional treatment is the cornerstone of classical homeopathy. It is a holistic approach where the selected remedy matches not only your physical disease symptoms but also your entire constitution: your mental temperament, emotional stresses, genetic background, response to weather/temperature, and dietary preferences. By treating the constitutional state, we strengthen the patient\'s entire system, promoting long-term resilience and health.'
              }
            ].map(faq => (
              <div className="faq-item" key={faq.id}>
                <button 
                  className="faq-question" 
                  aria-expanded={expandedFaq === faq.id}
                  onClick={() => toggleFaq(faq.id)}
                >
                  <span>{faq.q}</span>
                  <span className="faq-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </span>
                </button>
                <div 
                  className="faq-answer"
                  ref={el => { faqAnswerRefs.current[faq.id] = el; }}
                  style={{ maxHeight: expandedFaq === faq.id ? `${faqAnswerRefs.current[faq.id]?.scrollHeight}px` : '0px' }}
                >
                  <p>{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer-container">
          <div className="footer-brand">
            <Link href="#hero" className="footer-logo">
              <img src="/assets/logo.jpg" alt="Yashfeen Homeopathy Logo" className="logo-img" id="footer-logo-img" />
              <span className="logo-text">Yashfeen <span className="logo-subtext">Homeopathy</span></span>
            </Link>
            <p className="footer-tagline">Natural, gentle, and scientific healing for your entire family. Addressing root causes since 2011.</p>
          </div>

          <div className="footer-links">
            <h4>Quick Navigation</h4>
            <ul>
              <li><Link href="#hero">Home</Link></li>
              <li><Link href="#about">About Clinic</Link></li>
              <li><Link href="#services">Treatments</Link></li>
              <li><Link href="#info">Working Hours</Link></li>
              <li><Link href="#faq">FAQs</Link></li>
            </ul>
          </div>

          <div className="footer-contact">
            <h4>Contact Us</h4>
            <p className="footer-tagline" style={{ marginBottom: "16px" }}>Have questions or want to schedule an appointment? Get in touch with us.</p>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "12px", fontSize: "0.9rem" }}>
              <li><strong>Phone:</strong> <a href="tel:+923000000000" style={{ color: "#94a3b8", textDecoration: "none" }} id="footer-phone-link">{formattedPhone}</a></li>
              <li><strong>Email:</strong> <a href="mailto:info@yashfeenhomeopathy.online" style={{ color: "#94a3b8", textDecoration: "none" }}>info@yashfeenhomeopathy.online</a></li>
              <li><strong>Address:</strong> Phase 1, Lahore, Pakistan</li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="container footer-bottom-container">
            <p>&copy; 2026 Yashfeen Homeopathy. All Rights Reserved.</p>
            <p className="design-credit">Carefully crafted for natural wellness</p>
          </div>
        </div>
      </footer>
    </>
  );
}
