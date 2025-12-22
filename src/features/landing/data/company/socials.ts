import { FaFacebook, FaGoogle, FaInstagram, FaLinkedin } from 'react-icons/fa'
import { FaXTwitter } from 'react-icons/fa6'

export const socials = [
  {
    name: 'facebook',
    href: 'https://www.facebook.com/triprosremodeling',
    Icon: FaFacebook,
    className: ' hover:text-blue-800 dark:hover:text-blue-300',
  },
  {
    name: 'instagram',
    href: 'https://www.instagram.com/triprosremodeling',
    Icon: FaInstagram,
    className: 'hover:text-orange-800 dark:hover:text-orange-300',
  },
  {
    name: 'google',
    href: 'https://www.google.com/search?q=Tri%20Pros%20Remodeling',
    Icon: FaGoogle,
    className: 'hover:text-yellow-800 dark:hover:text-yellow-300',
  },
  {
    name: 'linkedin',
    href: 'https://www.linkedin.com/company/triprosremodeling',
    Icon: FaLinkedin,
    className: 'hover:text-blue-800 dark:hover:text-blue-300',
  },
  {
    name: 'x',
    href: 'https://x.com/tri_pros',
    Icon: FaXTwitter,
    className: 'hover:text-neutral-600 dark:hover:text-neutral-300',
  },
]
