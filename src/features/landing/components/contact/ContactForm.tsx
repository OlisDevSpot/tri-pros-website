'use client'

import { motion } from 'motion/react'
import { useState } from 'react'

export default function ContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<
    'idle' | 'success' | 'error'
  >('idle')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    projectType: '',
    timeline: '',
    budget: '',
    propertyType: '',
    propertySize: '',
    location: '',
    message: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus('idle')

    try {
      const response = await fetch('/api/inquiries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setSubmitStatus('success')
        // Reset form
        setFormData({
          name: '',
          email: '',
          phone: '',
          projectType: '',
          timeline: '',
          budget: '',
          propertyType: '',
          propertySize: '',
          location: '',
          message: '',
        })
      }
      else {
        setSubmitStatus('error')
      }
    }
    catch (error) {
      console.error('Error submitting form:', error)
      setSubmitStatus('error')
    }
    finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  return (
    <section className="bg-neutral-900 py-16 lg:py-24">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 ">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h2 className="font-serif text-2xl lg:text-3xl font-bold text-foreground mb-6">
            Request Your Consultation
          </h2>
          <p className="text-muted-foreground mb-8">
            Tell us about your project and we&apos;ll schedule a personalized
            consultation to discuss your vision, timeline, and budget.
          </p>

          <form
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            {/* Personal Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-semibold text-foreground mb-2"
                >
                  Full Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary"
                />
              </div>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-semibold text-foreground mb-2"
                >
                  Email Address *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-semibold text-foreground mb-2"
              >
                Phone Number *
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                required
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>

            {/* Project Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="projectType"
                  className="block text-sm font-semibold text-foreground mb-2"
                >
                  Project Type *
                </label>
                <select
                  id="projectType"
                  name="projectType"
                  required
                  value={formData.projectType}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary"
                >
                  <option value="">Select Project Type</option>
                  <option value="custom-home">Custom Home Construction</option>
                  <option value="renovation">Luxury Renovation</option>
                  <option value="commercial">Commercial Construction</option>
                  <option value="design-build">Design-Build Services</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="timeline"
                  className="block text-sm font-semibold text-foreground mb-2"
                >
                  Preferred Timeline
                </label>
                <select
                  id="timeline"
                  name="timeline"
                  value={formData.timeline}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary"
                >
                  <option value="">Select Timeline</option>
                  <option value="asap">As Soon As Possible</option>
                  <option value="3-months">Within 3 Months</option>
                  <option value="6-months">Within 6 Months</option>
                  <option value="1-year">Within 1 Year</option>
                  <option value="planning">Just Planning</option>
                </select>
              </div>
            </div>

            {/* Property Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label
                  htmlFor="propertyType"
                  className="block text-sm font-semibold text-foreground mb-2"
                >
                  Property Type
                </label>
                <select
                  id="propertyType"
                  name="propertyType"
                  value={formData.propertyType}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary"
                >
                  <option value="">Select Property Type</option>
                  <option value="single-family">Single Family Home</option>
                  <option value="multi-family">Multi-Family</option>
                  <option value="commercial">Commercial Building</option>
                  <option value="land">Vacant Land</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="propertySize"
                  className="block text-sm font-semibold text-foreground mb-2"
                >
                  Property/Project Size
                </label>
                <input
                  type="text"
                  id="propertySize"
                  name="propertySize"
                  placeholder="e.g., 3,500 sq ft"
                  value={formData.propertySize}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="location"
                className="block text-sm font-semibold text-foreground mb-2"
              >
                Project Location
              </label>
              <input
                type="text"
                id="location"
                name="location"
                placeholder="City, State"
                value={formData.location}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary"
              />
            </div>

            <div>
              <label
                htmlFor="message"
                className="block text-sm font-semibold text-foreground mb-2"
              >
                Project Description
              </label>
              <textarea
                id="message"
                name="message"
                rows={5}
                placeholder="Tell us about your vision, specific requirements, or any questions you have..."
                value={formData.message}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary resize-none"
              />
            </div>

            {/* Success/Error Messages */}
            {submitStatus === 'success' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-green-100 border border-green-300 rounded-lg text-green-800"
              >
                <div className="font-semibold">Success!</div>
                <div>
                  Your inquiry has been submitted successfully. We&apos;ll
                  contact you within 24 hours.
                </div>
              </motion.div>
            )}

            {submitStatus === 'error' && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-100 border border-red-300 rounded-lg text-red-800"
              >
                <div className="font-semibold">Error</div>
                <div>
                  There was an error submitting your inquiry. Please try again
                  or call us directly.
                </div>
              </motion.div>
            )}

            <motion.button
              type="submit"
              disabled={isSubmitting}
              whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
              whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
              className={`w-full py-4 rounded-lg font-semibold text-lg transition-colors duration-200 ${
                isSubmitting
                  ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/90'
              }`}
            >
              {isSubmitting ? 'Submitting...' : 'Schedule My Consultation'}
            </motion.button>

            <p className="text-sm text-muted-foreground text-center">
              By submitting this form, you agree to be contacted by Elite
              Construction. We respect your privacy and will never share your
              information.
            </p>
          </form>
        </motion.div>
      </div>
    </section>
  )
}
