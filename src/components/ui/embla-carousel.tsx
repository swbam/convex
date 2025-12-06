import React, { useCallback, useEffect, useState, useMemo } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import AutoScroll from 'embla-carousel-auto-scroll';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// Hook to detect mobile/touch devices
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth < 768;
      setIsMobile(isTouchDevice || isSmallScreen);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

// Hook to track selected index and scroll snaps
function useCarouselState(emblaApi: ReturnType<typeof useEmblaCarousel>[1]) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    setScrollSnaps(emblaApi.scrollSnapList());
    onSelect();
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

  return { selectedIndex, scrollSnaps, canScrollPrev, canScrollNext };
}

interface EmblaCarouselProps {
  children: React.ReactNode;
  className?: string;
  slideClassName?: string;
  autoScroll?: boolean;
  autoScrollSpeed?: number;
  showArrows?: boolean;
  showDots?: boolean;
  loop?: boolean;
  align?: 'start' | 'center' | 'end';
  slidesToScroll?: number | 'auto';
  containScroll?: 'trimSnaps' | 'keepSnaps' | false;
}

export function EmblaCarousel({
  children,
  className,
  slideClassName,
  autoScroll = true,
  autoScrollSpeed = 1,
  showArrows = true,
  showDots = true,
  loop = true,
  align = 'start',
  slidesToScroll = 'auto',
  containScroll = 'trimSnaps',
}: EmblaCarouselProps) {
  const isMobile = useIsMobile();

  // Configure plugins based on platform
  const plugins = useMemo(() => {
    // Only add auto-scroll on desktop
    if (!isMobile && autoScroll) {
      return [
        AutoScroll({
          speed: autoScrollSpeed,
          stopOnInteraction: false, // Resume after user drag
          stopOnMouseEnter: true,   // KEY: Pause on hover (Gametime behavior)
          stopOnFocusIn: true,
          playOnInit: true,
          startDelay: 1000,
        }),
      ];
    }
    return [];
  }, [isMobile, autoScroll, autoScrollSpeed]);

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      loop,
      align,
      slidesToScroll,
      containScroll,
      dragFree: isMobile, // Free momentum on mobile, snap on desktop
    },
    plugins
  );

  const { selectedIndex, scrollSnaps, canScrollPrev, canScrollNext } = useCarouselState(emblaApi);

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  const scrollTo = useCallback((index: number) => {
    if (emblaApi) emblaApi.scrollTo(index);
  }, [emblaApi]);

  // Convert children to array for mapping
  const slides = React.Children.toArray(children);

  return (
    <div className={cn('embla relative', className)}>
      {/* Navigation Arrows - Desktop only */}
      {showArrows && !isMobile && (
        <>
          <button
            onClick={scrollPrev}
            disabled={!loop && !canScrollPrev}
            className={cn(
              'absolute left-0 top-1/2 -translate-y-1/2 z-10',
              'w-10 h-10 rounded-full bg-background/90 backdrop-blur-sm',
              'border border-border shadow-lg',
              'flex items-center justify-center',
              'transition-all duration-200',
              'hover:bg-background hover:scale-110',
              'disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100',
              '-ml-5'
            )}
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-5 w-5 text-foreground" />
          </button>
          <button
            onClick={scrollNext}
            disabled={!loop && !canScrollNext}
            className={cn(
              'absolute right-0 top-1/2 -translate-y-1/2 z-10',
              'w-10 h-10 rounded-full bg-background/90 backdrop-blur-sm',
              'border border-border shadow-lg',
              'flex items-center justify-center',
              'transition-all duration-200',
              'hover:bg-background hover:scale-110',
              'disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100',
              '-mr-5'
            )}
            aria-label="Next slide"
          >
            <ChevronRight className="h-5 w-5 text-foreground" />
          </button>
        </>
      )}

      {/* Carousel Viewport */}
      <div 
        className="embla__viewport overflow-hidden" 
        ref={emblaRef}
        style={{ 
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div 
          className="embla__container flex touch-pan-x"
          style={{
            gap: '1rem',
            padding: '0 0.25rem',
            userSelect: 'none',
          }}
        >
          {slides.map((child, index) => (
            <div
              key={index}
              className={cn(
                'embla__slide flex-shrink-0',
                slideClassName
              )}
            >
              {child}
            </div>
          ))}
        </div>
      </div>

      {/* Dot Indicators - Mobile only */}
      {showDots && isMobile && scrollSnaps.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-4">
          {scrollSnaps.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              className={cn(
                'w-2 h-2 rounded-full transition-all duration-200',
                index === selectedIndex
                  ? 'bg-primary w-4'
                  : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
              )}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Preset slide widths for common use cases
export const SLIDE_SIZES = {
  xs: 'w-[140px]',      // Small mobile cards
  sm: 'w-[180px]',      // Mobile cards
  md: 'w-[240px]',      // Tablet cards
  lg: 'w-[280px]',      // Desktop cards
  xl: 'w-[320px]',      // Large desktop cards
  // Responsive presets
  artist: 'w-[160px] sm:w-[180px] md:w-[200px]',
  show: 'w-[160px] sm:w-[180px] md:w-[200px]',
  festival: 'w-[180px] sm:w-[200px] md:w-[240px]',
} as const;

export { useIsMobile };

