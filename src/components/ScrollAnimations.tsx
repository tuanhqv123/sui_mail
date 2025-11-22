import { useState, useEffect, useRef } from 'react';

interface ScrollRevealProps {
  children: React.ReactNode;
  threshold?: number;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}

export const ScrollReveal: React.FC<ScrollRevealProps> = ({
  children,
  threshold = 0.1,
  delay = 0,
  direction = 'up'
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay);
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [threshold, delay]);

  const getTransform = () => {
    if (isVisible) return 'translate(0, 0) scale(1)';

    switch (direction) {
      case 'up': return 'translateY(80px) scale(0.92)';
      case 'down': return 'translateY(-80px) scale(0.92)';
      case 'left': return 'translateX(80px) scale(0.92)';
      case 'right': return 'translateX(-80px) scale(0.92)';
      default: return 'translateY(80px) scale(0.92)';
    }
  };

  return (
    <div
      ref={ref}
      className="transition-all duration-1200 ease-out"
      style={{
        transform: getTransform(),
        opacity: isVisible ? 1 : 0,
      }}
    >
      {children}
    </div>
  );
};

interface ParallaxProps {
  children: React.ReactNode;
  speed?: number;
  className?: string;
}

export const Parallax: React.FC<ParallaxProps> = ({
  children,
  speed = 0.5,
  className = ''
}) => {
  const [offset, setOffset] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (ref.current) {
        const rect = ref.current.getBoundingClientRect();
        const scrolled = window.pageYOffset;
        const rate = scrolled * speed;
        setOffset(rate);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [speed]);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        transform: `translateY(${offset}px)`,
      }}
    >
      {children}
    </div>
  );
};

interface FloatingElementsProps {
  className?: string;
}

export const FloatingElements: React.FC<FloatingElementsProps> = ({ className = '' }) => {
  return (
    <div className={`fixed inset-0 pointer-events-none overflow-hidden ${className}`}>
      <div className="absolute top-20 left-10 w-40 h-40 bg-cyan-300/30 rounded-full mix-blend-multiply filter blur-3xl-enhanced opacity-50 animate-float-slow" />
      <div className="absolute top-60 right-16 w-56 h-56 bg-blue-300/25 rounded-full mix-blend-multiply filter blur-3xl-enhanced opacity-45 animate-float-slow" style={{ animationDelay: '3s' }} />
      <div className="absolute bottom-32 left-1/2 w-48 h-48 bg-indigo-300/20 rounded-full mix-blend-multiply filter blur-3xl-enhanced opacity-40 animate-float-slow" style={{ animationDelay: '6s' }} />
      <div className="absolute top-1/3 right-1/3 w-44 h-44 bg-purple-300/15 rounded-full mix-blend-multiply filter blur-3xl-enhanced opacity-35 animate-float-slow" style={{ animationDelay: '9s' }} />
      <div className="absolute bottom-1/4 left-1/4 w-52 h-52 bg-teal-300/20 rounded-full mix-blend-multiply filter blur-3xl-enhanced opacity-30 animate-float-slow" style={{ animationDelay: '12s' }} />
    </div>
  );
};

interface Web3BadgeProps {
  icon: React.ReactNode;
  text: string;
  className?: string;
}

export const Web3Badge: React.FC<Web3BadgeProps> = ({ icon, text, className = '' }) => {
  return (
    <div className={`group relative inline-flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-900 rounded-full shadow-[4px_4px_0px_0px_rgba(17,24,39,1)] hover:shadow-[2px_2px_0px_0px_rgba(17,24,39,1)] hover:translate-x-1 hover:translate-y-1 transition-all duration-200 ${className}`}>
      <div className="w-6 h-6 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg border border-gray-900 flex items-center justify-center">
        {icon}
      </div>
      <span className="text-sm font-bold text-gray-900">{text}</span>
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-200" />
    </div>
  );
};