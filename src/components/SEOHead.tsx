import { useEffect } from 'react';

interface SEOHeadProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
}

export function SEOHead({ title, description, image, url }: SEOHeadProps) {
  useEffect(() => {
    // Update page title
    document.title = title;
    
    // Update meta description
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', description || 'Vote on songs you want to hear and discover trending artists and shows');
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = description || 'Vote on songs you want to hear and discover trending artists and shows';
      document.head.appendChild(meta);
    }
    
    // Update Open Graph tags
    const updateOGTag = (property: string, content: string) => {
      let tag = document.querySelector(`meta[property="${property}"]`);
      if (tag) {
        tag.setAttribute('content', content);
      } else {
        tag = document.createElement('meta');
        tag.setAttribute('property', property);
        tag.setAttribute('content', content);
        document.head.appendChild(tag);
      }
    };
    
    updateOGTag('og:title', title);
    updateOGTag('og:description', description || 'Vote on songs you want to hear and discover trending artists and shows');
    updateOGTag('og:type', 'website');
    if (url) updateOGTag('og:url', url);
    if (image) updateOGTag('og:image', image);
    
    // Update Twitter Card tags
    const updateTwitterTag = (name: string, content: string) => {
      let tag = document.querySelector(`meta[name="${name}"]`);
      if (tag) {
        tag.setAttribute('content', content);
      } else {
        tag = document.createElement('meta');
        tag.setAttribute('name', name);
        tag.setAttribute('content', content);
        document.head.appendChild(tag);
      }
    };
    
    updateTwitterTag('twitter:card', 'summary_large_image');
    updateTwitterTag('twitter:title', title);
    updateTwitterTag('twitter:description', description || 'Vote on songs you want to hear and discover trending artists and shows');
    if (image) updateTwitterTag('twitter:image', image);
    
  }, [title, description, image, url]);

  return null; // This component doesn't render anything
}
