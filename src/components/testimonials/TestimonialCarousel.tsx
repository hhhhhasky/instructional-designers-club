import { useCallback, useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface TestimonialImage {
  url: string;
  alt: string;
}

interface TestimonialCarouselProps {
  images: TestimonialImage[];
  autoplayDelay?: number;
}

export function TestimonialCarousel({ images, autoplayDelay = 5000 }: TestimonialCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'center' });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  const scrollTo = useCallback(
    (index: number) => {
      if (emblaApi) emblaApi.scrollTo(index);
    },
    [emblaApi]
  );

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;

    onSelect();
    setScrollSnaps(emblaApi.scrollSnapList());
    emblaApi.on('select', onSelect);
    emblaApi.on('reInit', onSelect);

    return () => {
      emblaApi.off('select', onSelect);
      emblaApi.off('reInit', onSelect);
    };
  }, [emblaApi, onSelect]);

  // 自动轮播
  useEffect(() => {
    if (!emblaApi || !autoplayDelay) return;

    const autoplay = setInterval(() => {
      emblaApi.scrollNext();
    }, autoplayDelay);

    return () => clearInterval(autoplay);
  }, [emblaApi, autoplayDelay]);

  return (
    <div className="relative">
      {/* 轮播容器 */}
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {images.map((image, index) => (
            <div key={index} className="flex-[0_0_100%] min-w-0 px-2 md:px-4">
              <Card className="border-bd shadow-ds-md overflow-hidden">
                <CardContent className="p-0">
                  <img
                    src={image.url}
                    alt={image.alt}
                    className="w-full h-auto object-contain max-h-[600px] md:max-h-[700px]"
                    loading="lazy"
                  />
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>

      {/* 左右箭头按钮 */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 bg-cream/95 backdrop-blur-sm hover:bg-acl border border-bd/50 shadow-xl z-10 h-12 w-12 rounded-full transition-all duration-300 hover:scale-110 hover:border-ac/50"
        onClick={scrollPrev}
        aria-label="上一张"
      >
        <ChevronLeft className="w-6 h-6 text-tx" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 bg-cream/95 backdrop-blur-sm hover:bg-acl border border-bd/50 shadow-xl z-10 h-12 w-12 rounded-full transition-all duration-300 hover:scale-110 hover:border-ac/50"
        onClick={scrollNext}
        aria-label="下一张"
      >
        <ChevronRight className="w-6 h-6 text-tx" />
      </Button>

      {/* 圆点指示器 */}
      <div className="flex justify-center gap-2 mt-6">
        {scrollSnaps.map((_, index) => (
          <button
            key={index}
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              index === selectedIndex
                ? 'bg-ac w-8'
                : 'bg-txt/30 hover:bg-txt/50'
            }`}
            onClick={() => scrollTo(index)}
            aria-label={`跳转到第 ${index + 1} 张`}
          />
        ))}
      </div>

      {/* 计数器 */}
      <div className="text-center mt-4">
        <p className="text-sm text-txs">
          {selectedIndex + 1} / {images.length}
        </p>
      </div>
    </div>
  );
}
