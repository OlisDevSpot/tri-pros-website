import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Terms of Service for Tri Pros Remodeling — the rules that govern your use of triprosremodeling.com and related services.',
}

export default function TermsOfServicePage() {
  return (
    <main className="container max-w-3xl py-16 md:py-24">
      <h1 className="mb-2 text-3xl font-bold tracking-tight md:text-4xl">
        Terms of Service
      </h1>
      <p className="text-muted-foreground mb-10 text-sm">
        Last updated: May 21, 2026
      </p>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-semibold">
        <section>
          <h2>1. Agreement to These Terms</h2>
          <p>
            {'These Terms of Service (“Terms”) are a binding legal agreement between you and '}
            <strong>Tri Pros Remodeling</strong>
            {' (“Tri Pros,” “we,” “us,” or “our”), a residential construction and remodeling company based in Southern California. They govern your access to and use of '}
            <strong>triprosremodeling.com</strong>
            {' and any related websites, applications, dashboards, forms, and online services we offer (collectively, the “Services”).'}
          </p>
          <p>
            {'By accessing or using the Services, by creating an account, or by submitting a contact, estimate, or scheduling request through the Services, you agree to these Terms and to our '}
            <Link href="/privacy">Privacy Policy</Link>
            . If you do not agree, do not use the Services.
          </p>
        </section>

        <section>
          <h2>2. Eligibility</h2>
          <p>
            You must be at least 18 years old and legally able to enter into a
            binding contract to use the Services. If you use the Services on
            behalf of a household, business, or other entity, you represent
            that you are authorized to bind that party to these Terms.
          </p>
        </section>

        <section>
          <h2>3. What the Services Are (and What They Are Not)</h2>
          <p>The Services let you:</p>
          <ul>
            <li>Learn about our remodeling and construction offerings.</li>
            <li>Request an estimate or schedule an in-home consultation.</li>
            <li>Receive, review, and electronically sign project proposals.</li>
            <li>
              Access customer- or agent-facing dashboards we make available to
              you.
            </li>
          </ul>
          <p>
            <strong>The Services are informational and transactional tools.</strong>
            {' They are not a construction contract. Any actual remodeling or construction work we perform for you is governed by a separate written proposal or agreement signed by both parties (the “Project Agreement”). In the event of any conflict between these Terms and a signed Project Agreement, the Project Agreement controls with respect to the work described in it.'}
          </p>
        </section>

        <section>
          <h2>4. Accounts &amp; Sign-In</h2>
          <p>
            {'Some features require you to sign in (currently via Google OAuth). You are responsible for the security of your account, for all activity that occurs under it, and for keeping the email address linked to it accurate. Notify us immediately at '}
            <strong>oliver@triprosremodeling.com</strong>
            {' if you suspect unauthorized access. We may suspend or terminate any account that we reasonably believe is being misused or that violates these Terms.'}
          </p>
        </section>

        <section>
          <h2>5. Estimates, Proposals &amp; Pricing</h2>
          <ul>
            <li>
              <strong>Estimates are not contracts.</strong>
              {' Any pricing, ballpark figures, or rough scopes shared during a consultation, by phone, by email, or through the Services are non-binding estimates only.'}
            </li>
            <li>
              <strong>Proposals are offers, not acceptances.</strong>
              {' A formal written proposal becomes a binding agreement only when both parties sign it (electronically or in ink).'}
            </li>
            <li>
              <strong>Prices may change.</strong>
              {' Material costs, scope changes, site conditions discovered after walkthrough, and permitting requirements can affect final pricing. Any change to a signed Project Agreement requires a written change order.'}
            </li>
          </ul>
        </section>

        <section>
          <h2>6. Consent to Be Contacted</h2>
          <p>
            By submitting your contact information through the Services
            (including any inquiry, estimate request, scheduling form, or
            similar submission), you authorize Tri Pros and its representatives
            to contact you by phone, email, text message (SMS), or other means
            using the information you provided. We may contact you for purposes
            including:
          </p>
          <ul>
            <li>Responding to your inquiry or scheduling a consultation.</li>
            <li>
              Sending transactional messages such as appointment reminders,
              proposal links, and e-signature requests.
            </li>
            <li>Following up on an active or prior project.</li>
            <li>
              Sharing information about services, promotions, or programs that
              may be relevant to you.
            </li>
          </ul>
          <p>
            This consent applies even if the phone number you provide is on a
            federal or state Do Not Call registry. Consent to receive marketing
            messages is not a condition of purchase. Standard message and data
            rates may apply.
          </p>
        </section>

        <section>
          <h2>7. SMS / Text Messaging Terms</h2>
          <p>
            If you opt in to receive text messages from us, you agree to receive recurring automated and non-automated text messages (such as appointment reminders, proposal notifications, and project updates) at the mobile number you provided. Message frequency varies. Message and data rates may apply.
          </p>
          <ul>
            <li>
              <strong>Opt out</strong>
              {' at any time by replying '}
              <strong>STOP</strong>
              {' to any text message from us.'}
            </li>
            <li>
              <strong>Get help</strong>
              {' by replying '}
              <strong>HELP</strong>
              {' or by contacting us at oliver@triprosremodeling.com.'}
            </li>
            <li>
              Carriers are not liable for delayed or undelivered messages.
            </li>
          </ul>
          <p>
            {'See our '}
            <Link href="/privacy">Privacy Policy</Link>
            {' for how we handle the phone number and other information you provide.'}
          </p>
        </section>

        <section>
          <h2>8. Call Recording &amp; Communication Monitoring</h2>
          <p>
            Calls between you and Tri Pros may be recorded or monitored for quality assurance, training, dispute resolution, and record-keeping purposes. California is a two-party consent state. By continuing a call with us after being notified that the call may be recorded, you consent to the recording. If you do not consent, please notify the Tri Pros team member during the call and we will end the recording or end the call.
          </p>
        </section>

        <section>
          <h2>9. Electronic Communications &amp; E-Signature</h2>
          <p>
            You agree that we may provide notices, disclosures, agreements, and other communications to you electronically (by email, in-app message, SMS, or by posting them in the Services). You agree that electronic signatures, contracts, orders, and other records, and electronic delivery of notices, policies, and records of transactions, satisfy any legal requirement that such communications be in writing, consistent with the federal ESIGN Act and the California Uniform Electronic Transactions Act (Cal. Civ. Code § 1633.1 et seq.).
          </p>
          <p>
            You may withdraw consent to receive electronic communications by
            contacting us, but doing so may prevent us from providing the
            Services to you.
          </p>
        </section>

        <section>
          <h2>10. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>
              Use the Services in any way that violates any applicable law or
              regulation.
            </li>
            <li>
              Submit false, misleading, or fraudulent information (including
              names, addresses, phone numbers, or project details).
            </li>
            <li>
              Impersonate any person or entity, or misrepresent your
              affiliation with anyone.
            </li>
            <li>
              Interfere with, disrupt, or attempt to gain unauthorized access
              to the Services, accounts, servers, or networks.
            </li>
            <li>
              Scrape, copy, or harvest content, data, or imagery from the
              Services for any commercial purpose, or use automated systems to
              access the Services beyond ordinary browser use.
            </li>
            <li>
              Reverse engineer, decompile, or attempt to derive the source code
              of any portion of the Services, except as permitted by law.
            </li>
            <li>
              Upload or transmit any virus, malware, or other harmful code.
            </li>
            <li>
              Use the Services to send unsolicited communications or to
              infringe any third party&apos;s rights.
            </li>
          </ul>
        </section>

        <section>
          <h2>11. User Submissions</h2>
          <p>
            When you submit photos, videos, project descriptions, reviews, testimonials, messages, or other content (“User Content”) through the Services, you represent that you own or have permission to share it, and you grant Tri Pros a non-exclusive, royalty-free, worldwide, sublicensable license to use, reproduce, modify, display, and distribute that content for the purposes of providing the Services, communicating with you about your project, and (where you have separately consented) for marketing purposes such as portfolio and case-study showcases.
          </p>
          <p>
            You can ask us to remove specific User Content at any time by
            contacting oliver@triprosremodeling.com. We will honor reasonable
            removal requests for forward-looking use, but we may retain copies
            as required by law or in our normal record-keeping.
          </p>
        </section>

        <section>
          <h2>12. Intellectual Property</h2>
          <p>
            The Services, including all designs, text, graphics, photographs (other than your own User Content), trade names, trademarks, logos, software, and the overall look and feel, are owned by Tri Pros or its licensors and are protected by U.S. and international intellectual property laws. We grant you a limited, personal, non-exclusive, non-transferable, revocable license to access and use the Services for their intended purpose. No other rights are granted, and any rights not expressly granted are reserved.
          </p>
        </section>

        <section>
          <h2>13. Third-Party Services &amp; Links</h2>
          <p>
            The Services integrate with or link to third-party services
            (including, for example, Google OAuth, e-signature providers, SMS
            carriers, calendar and mapping providers, and analytics tools). We
            do not control those third parties, do not endorse their content,
            and are not responsible for their availability, accuracy, terms,
            or privacy practices. Your use of any third-party service is
            governed by that party&apos;s terms.
          </p>
        </section>

        <section>
          <h2>14. Disclaimer of Warranties</h2>
          <p>
            THE SERVICES, ALL CONTENT, AND ALL INFORMATION PROVIDED THROUGH THEM (INCLUDING ESTIMATES, PRICING, AVAILABILITY, AND PROJECT TIMELINES) ARE PROVIDED “AS IS” AND “AS AVAILABLE” WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY. TRI PROS DISCLAIMS, TO THE FULLEST EXTENT PERMITTED BY LAW, ALL WARRANTIES INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, ACCURACY, AND THAT THE SERVICES WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE.
          </p>
          <p>
            This disclaimer applies only to your use of the Services and does
            not limit any warranties expressly given in a signed Project
            Agreement covering actual construction work, or any warranties
            that cannot be disclaimed under applicable law (including under
            California Business and Professions Code provisions governing
            licensed contractors).
          </p>
        </section>

        <section>
          <h2>15. Limitation of Liability</h2>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT WILL TRI PROS, ITS OWNERS, EMPLOYEES, AGENTS, OR CONTRACTORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, DATA, GOODWILL, OR BUSINESS OPPORTUNITY, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICES, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
          </p>
          <p>
            TRI PROS’ TOTAL AGGREGATE LIABILITY ARISING OUT OF OR RELATED TO THE SERVICES (AS DISTINCT FROM ANY SIGNED PROJECT AGREEMENT) WILL NOT EXCEED ONE HUNDRED U.S. DOLLARS (US$100). NOTHING IN THIS SECTION LIMITS LIABILITY THAT CANNOT BE LIMITED UNDER APPLICABLE LAW, INCLUDING LIABILITY FOR GROSS NEGLIGENCE, FRAUD, OR WILLFUL MISCONDUCT.
          </p>
        </section>

        <section>
          <h2>16. Indemnification</h2>
          <p>
            You agree to defend, indemnify, and hold harmless Tri Pros and its owners, employees, agents, and contractors from and against any claims, liabilities, damages, losses, and expenses (including reasonable attorneys’ fees) arising out of or related to: (a) your use of or access to the Services; (b) your violation of these Terms; (c) any User Content you submit; or (d) your violation of any third-party right or applicable law.
          </p>
        </section>

        <section>
          <h2>17. Termination &amp; Suspension</h2>
          <p>
            We may suspend or terminate your access to all or part of the
            Services at any time, with or without notice, for any reason,
            including if we believe you have violated these Terms. You may
            stop using the Services at any time. Sections that by their nature
            should survive termination (including Sections 11&ndash;19) will
            survive.
          </p>
        </section>

        <section>
          <h2>18. Governing Law &amp; Venue</h2>
          <p>
            These Terms and any dispute arising out of or related to them or
            the Services are governed by the laws of the State of California,
            without regard to its conflict-of-laws rules. Subject to the
            dispute resolution provisions below, you and Tri Pros agree to
            submit to the exclusive jurisdiction of the state and federal
            courts located in the county in which Tri Pros maintains its
            principal place of business in Southern California.
          </p>
        </section>

        <section>
          <h2>19. Dispute Resolution; Class Action Waiver</h2>
          <p>
            <strong>Informal resolution first.</strong>
            {' Before filing a claim, you agree to try to resolve the dispute informally by contacting us at '}
            <strong>oliver@triprosremodeling.com</strong>
            {' with a written description of the issue and the relief you are seeking. We will try in good faith to resolve the dispute within 30 days.'}
          </p>
          <p>
            <strong>Binding arbitration.</strong>
            {' If we cannot resolve the dispute informally, any dispute, claim, or controversy arising out of or relating to these Terms or the Services will be resolved by '}
            <strong>final and binding individual arbitration</strong>
            {' administered by JAMS under its applicable rules, with the arbitration taking place in Los Angeles or Orange County, California (or another location mutually agreed). Judgment on the arbitration award may be entered in any court of competent jurisdiction.'}
          </p>
          <p>
            <strong>Carve-outs.</strong>
            {' This arbitration agreement does not apply to: (a) claims that may be brought in small claims court; (b) requests for temporary or preliminary injunctive relief to protect intellectual property or confidential information; (c) any mechanics’ lien, stop-payment notice, or other statutory remedy under California construction law; or (d) any claim that, by law, cannot be subject to mandatory pre-dispute arbitration (including claims for sexual assault or sexual harassment under the Ending Forced Arbitration of Sexual Assault and Sexual Harassment Act).'}
          </p>
          <p>
            <strong>CLASS &amp; REPRESENTATIVE ACTION WAIVER.</strong>
            {' YOU AND TRI PROS AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR OR ITS INDIVIDUAL CAPACITY, AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS, COLLECTIVE, OR REPRESENTATIVE PROCEEDING. THE ARBITRATOR MAY NOT CONSOLIDATE MORE THAN ONE PERSON’S CLAIMS OR PRESIDE OVER ANY FORM OF REPRESENTATIVE OR CLASS PROCEEDING.'}
          </p>
          <p>
            <strong>JURY TRIAL WAIVER.</strong>
            {' TO THE EXTENT ANY CLAIM PROCEEDS IN COURT RATHER THAN ARBITRATION, YOU AND TRI PROS EACH KNOWINGLY AND VOLUNTARILY WAIVE THE RIGHT TO A JURY TRIAL.'}
          </p>
          <p>
            <strong>Opt out of arbitration.</strong>
            {' You may opt out of the arbitration and class-waiver provisions of this Section 19 by sending written notice to oliver@triprosremodeling.com within 30 days of first accepting these Terms. Your notice must include your full name, mailing address, and a clear statement that you wish to opt out of arbitration.'}
          </p>
        </section>

        <section>
          <h2>20. Changes to These Terms</h2>
          <p>
            We may update these Terms from time to time. When we do, we will
            change the &ldquo;Last updated&rdquo; date above and, for material
            changes, take reasonable steps to notify you (for example, by
            posting a notice on the Services or sending you an email). Your
            continued use of the Services after the effective date of the
            updated Terms means you accept the changes. If you do not agree,
            you must stop using the Services.
          </p>
        </section>

        <section>
          <h2>21. Miscellaneous</h2>
          <ul>
            <li>
              <strong>Entire agreement.</strong>
              {' These Terms, together with our Privacy Policy and any signed Project Agreement, are the entire agreement between you and Tri Pros regarding the Services and supersede any prior agreements on the same subject.'}
            </li>
            <li>
              <strong>Severability.</strong>
              {' If any provision of these Terms is held to be unenforceable, that provision will be enforced to the maximum extent permissible and the remaining provisions will remain in full force and effect.'}
            </li>
            <li>
              <strong>No waiver.</strong>
              {' Our failure to enforce any provision is not a waiver of our right to do so later.'}
            </li>
            <li>
              <strong>Assignment.</strong>
              {' You may not assign these Terms without our written consent. We may assign them to an affiliate or in connection with a merger, acquisition, or sale of assets.'}
            </li>
            <li>
              <strong>Force majeure.</strong>
              {' We are not liable for any delay or failure to perform caused by events outside our reasonable control, including natural disasters, labor disputes, supply chain disruptions, government actions, or internet or utility outages.'}
            </li>
            <li>
              <strong>Headings.</strong>
              {' Section headings are for convenience only and do not affect interpretation.'}
            </li>
          </ul>
        </section>

        <section>
          <h2>22. Contact</h2>
          <p>
            Questions about these Terms? Reach out:
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
