import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Privacy policy for Tri Pros Remodeling — how we collect, use, and protect your personal information.',
}

export default function PrivacyPolicyPage() {
  return (
    <main className="container max-w-3xl py-16 md:py-24">
      <h1 className="mb-2 text-3xl font-bold tracking-tight md:text-4xl">
        Privacy Policy
      </h1>
      <p className="text-muted-foreground mb-10 text-sm">
        Last updated: June 25, 2026
      </p>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold">
        <section>
          <h2>1. Who We Are</h2>
          <p>
            {'Tri Pros Remodeling (\u201Cwe,\u201D \u201Cus,\u201D or \u201Cour\u201D) operates the website '}
            <strong>triprosremodeling.com</strong>
            {' and related services. We are a residential construction and remodeling company based in Southern California.'}
          </p>
        </section>

        <section>
          <h2>2. Information We Collect</h2>
          <p>We may collect the following types of information:</p>
          <ul>
            <li>
              <strong>Contact information</strong>
              {' — name, email address, phone number, and home address provided when you request an estimate, schedule a meeting, or contact us.'}
            </li>
            <li>
              <strong>Property information</strong>
              {' — details about your home (age, square footage, scope of desired work) shared during consultations.'}
            </li>
            <li>
              <strong>Account data</strong>
              {' — email and authentication information when you sign in via Google OAuth.'}
            </li>
            <li>
              <strong>Usage data</strong>
              {' — pages visited, time on site, browser type, and device information collected automatically through cookies and analytics.'}
            </li>
            <li>
              <strong>Communications</strong>
              {' — messages, emails, and call recordings when you interact with our team.'}
            </li>
          </ul>
        </section>

        <section>
          <h2>3. How We Use Your Information</h2>
          <ul>
            <li>To provide estimates, proposals, and project services you request.</li>
            <li>To schedule and manage in-home consultations.</li>
            <li>To communicate with you about your project or inquiry.</li>
            <li>To send transactional emails (e.g., proposal links, e-signatures).</li>
            <li>To improve our website, services, and customer experience.</li>
            <li>To comply with legal obligations.</li>
          </ul>
        </section>

        <section>
          <h2>4. SMS / Text Message Program</h2>
          <p>
            When you opt in to text messages from Tri Pros Remodeling on our
            contact form, we use your mobile phone number to send messages
            related to your inquiry and project — such as callback scheduling,
            voicemail follow-ups, appointment confirmations, and proposal-review
            links. Message frequency varies. Message and data rates may apply.
          </p>
          <p>
            You can opt out at any time by replying
            {' '}
            <strong>STOP</strong>
            {' to any message. Reply '}
            <strong>HELP</strong>
            {' for help, or contact us at oliver@triprosremodeling.com.'}
          </p>
          <p>
            <strong>Mobile information sharing.</strong>
            {' No mobile information will be shared with third parties or affiliates for marketing or promotional purposes. All other categories of personal information exclude text-messaging originator opt-in data and consent; this information will not be shared with any third parties.'}
          </p>
          <p>
            We may share mobile information with service providers (such as our
            messaging carrier, CRM, and e-signature platform) only as needed to
            deliver the SMS program, under written confidentiality obligations.
          </p>
          <p>
            We retain SMS opt-in records and consent evidence (including
            timestamp, IP address, user agent, and the disclosure text shown at
            opt-in) for the period required by federal and state
            telecommunications regulations.
          </p>
        </section>

        <section>
          <h2>5. How We Share Your Information</h2>
          <p>
            {'We do '}
            <strong>not</strong>
            {' sell your personal information. Subject to the mobile information sharing restrictions in Section 4 above, we may share other information with:'}
          </p>
          <ul>
            <li>
              <strong>Service providers</strong>
              {' — trusted third parties that help us operate (e.g., email delivery, e-signature, cloud hosting, analytics).'}
            </li>
            <li>
              <strong>Legal requirements</strong>
              {' — when required by law, court order, or governmental request.'}
            </li>
            <li>
              <strong>Business transfers</strong>
              {' — in connection with a merger, acquisition, or sale of assets.'}
            </li>
          </ul>
        </section>

        <section>
          <h2>6. Cookies &amp; Tracking</h2>
          <p>
            We use cookies and similar technologies to analyze site traffic and
            improve your experience. You can control cookies through your
            browser settings. Disabling cookies may limit some site
            functionality.
          </p>
          <p>
            <strong>Advertising &amp; conversion measurement.</strong>
            {' We use advertising tools — including the Meta (Facebook/Instagram) Pixel and Conversions API — to measure the effectiveness of our ads and improve their relevance. When you submit a form, we may share a '}
            <strong>cryptographically hashed (one-way, irreversible)</strong>
            {' version of your contact details, such as your phone number, with Meta so it can match the conversion to an ad without exposing your raw information. We also share related identifiers such as cookie IDs, your IP address, and click identifiers. We do not share your raw phone number, name, or address with advertising partners for this purpose. You can manage ad personalization in your '}
            <strong>Meta account settings</strong>
            {' and limit tracking through your browser and device privacy controls.'}
          </p>
        </section>

        <section>
          <h2>7. Data Security</h2>
          <p>
            We implement reasonable technical and organizational measures to
            protect your personal information. However, no method of
            transmission over the Internet is 100% secure.
          </p>
        </section>

        <section>
          <h2>8. Data Retention</h2>
          <p>
            We retain your personal information only as long as necessary to
            fulfill the purposes described in this policy, or as required by
            law. You may request deletion of your data at any time.
          </p>
        </section>

        <section>
          <h2>9. Your Rights</h2>
          <p>
            Depending on your location, you may have the right to:
          </p>
          <ul>
            <li>Access the personal data we hold about you.</li>
            <li>Request correction of inaccurate data.</li>
            <li>Request deletion of your data.</li>
            <li>Opt out of marketing communications.</li>
            <li>
              If you are a California resident, exercise rights under the
              California Consumer Privacy Act (CCPA), including the right to
              know, delete, and opt out of the sale of personal information.
            </li>
          </ul>
        </section>

        <section>
          <h2>10. Third-Party Links</h2>
          <p>
            Our site may contain links to third-party websites. We are not
            responsible for the privacy practices of those sites.
          </p>
        </section>

        <section>
          <h2>11. Children&apos;s Privacy</h2>
          <p>
            Our services are not directed at individuals under 18. We do not
            knowingly collect information from children.
          </p>
        </section>

        <section>
          <h2>12. Changes to This Policy</h2>
          <p>
            We may update this policy from time to time. Changes will be posted
            on this page with an updated effective date.
          </p>
        </section>

        <section>
          <h2>13. Contact Us</h2>
          <p>
            If you have questions about this privacy policy or your personal
            data, contact us at:
          </p>
          <p>
            <strong>Tri Pros Remodeling</strong>
            <br />
            Email: oliver@triprosremodeling.com
            <br />
            Website: triprosremodeling.com
          </p>
        </section>
      </div>
    </main>
  )
}
