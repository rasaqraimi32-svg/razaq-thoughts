export const categories = ["Society", "Technology", "Education", "Culture", "Philosophy", "Development"] as const;
export type Category = (typeof categories)[number];
export type ContentBlock = { type: "paragraph" | "heading" | "quote"; text: string };
export type Article = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: Category;
  author: string;
  publishedAt: string;
  readingTime: number;
  content: ContentBlock[];
  featured: boolean;
};

type ArticleSeed = Omit<Article, "id" | "author" | "readingTime" | "content" | "featured"> & {
  featured?: boolean;
  body: [ContentBlock["type"], string][];
};

const seeds: ArticleSeed[] = [
  {
    slug: "the-art-of-paying-attention",
    title: "The art of paying attention in a distracted world",
    excerpt: "When everything asks for our attention, choosing what deserves it becomes a quiet act of intention.",
    category: "Technology",
    publishedAt: "2026-09-18",
    featured: true,
    body: [
      ["paragraph", "There is a small pause between reaching for a phone and remembering why we picked it up. Sometimes that pause is enough to reveal something uncomfortable: we were not looking for anything in particular. We were simply filling a moment that had not yet been given a purpose. It is an ordinary experience, but it opens a larger question about how we want to spend our days."],
      ["paragraph", "Digital tools make many valuable things possible. A message can sustain a friendship across a border. A recorded lecture can open a subject to someone who cannot attend a classroom. The difficulty begins when the tools that help us connect also decide, by default, what we notice next. Convenience does not always leave room for a conscious choice."],
      ["heading", "Attention is more than productivity"],
      ["paragraph", "Conversations about distraction often turn quickly to output: how many pages we read, how many tasks we finish, how much more efficiently we could work. Those questions have a place. But attention also shapes experiences that cannot be measured by completed tasks. Listening to a friend, noticing a change in a familiar street, or sitting with an idea all require a kind of presence that may produce nothing immediate."],
      ["paragraph", "Consider an imagined evening meal where every person leaves their phone in another room. The meal is not automatically more meaningful. There may be awkward silences and unfinished conversations. Yet something has changed: those at the table have made themselves available to one another. They have created the possibility of attention without demanding a particular result."],
      ["quote", "What we give our attention to gradually becomes the texture of our lives."],
      ["heading", "Make room before making rules"],
      ["paragraph", "A useful starting point may be to create a small space rather than a strict system. Read a few pages before opening a feed. Take one short walk without headphones. Turn off a notification that rarely brings anything useful. These are invitations to notice a difference, not universal prescriptions. A person whose work depends on urgent messages will need different boundaries from someone studying at home."],
      ["paragraph", "The environment matters as much as individual discipline. A workplace that expects an immediate answer to every message cannot reasonably ask people to protect uninterrupted time. A classroom that rewards only quick responses may leave little room for careful thought. If attention matters, it needs support in the habits and expectations we build together."],
      ["heading", "A question to carry forward"],
      ["paragraph", "There is no need to imagine a life without screens in order to ask for a more deliberate relationship with them. The aim can be modest: to recognise when a tool serves a purpose, and when a habit has taken over. That distinction will shift from day to day. It deserves curiosity rather than a verdict about personal willpower."],
      ["paragraph", "For one day, try noticing the moments when you feel most present. What are you doing? Who is with you? What has been allowed to fall quiet? The answers may offer a better starting point than another set of rules. What is one small change that would help you give more attention to something you already value?"]
    ]
  },
  {
    slug: "the-places-that-bring-us-together",
    title: "The everyday places that bring us together",
    excerpt: "Libraries, parks and shared tables remind us that belonging is often built in the most ordinary places.",
    category: "Society",
    publishedAt: "2026-09-16",
    body: [
      ["paragraph", "A public bench rarely appears in a grand account of community life. Neither does the table near a library window or the patch of shade beside a local shop. Yet these ordinary places can make room for encounters that would otherwise never happen. They allow people to be around one another without needing an invitation, a membership, or a carefully arranged occasion."],
      ["paragraph", "Imagine two neighbours who recognise each other from a morning walk. For weeks they exchange only a nod. One day a broken gate gives them something to discuss. Later, they learn each other's names. This is an illustrative scene, not a report of a particular community, but it shows how familiarity can accumulate through small, repeated meetings."],
      ["heading", "Belonging needs somewhere to happen"],
      ["paragraph", "It is tempting to think of community as an attitude: people should be more friendly, generous, or involved. Physical conditions matter too. A comfortable place to sit can make a longer conversation possible. A safe crossing can allow an older resident to reach a park. An accessible entrance can determine whether someone is included at all. Good intentions need places where they can become ordinary actions."],
      ["paragraph", "A shared space does not need to be elaborate. Its value may lie in being predictable and available. Knowing that a library is open on a particular afternoon can matter more than an occasional impressive event. People build routines around what they can depend on. Those routines, in turn, help strangers become familiar faces."],
      ["quote", "A place becomes shared when people can arrive without having to justify their presence."],
      ["heading", "Who feels welcome?"],
      ["paragraph", "Calling a place public does not mean everyone experiences it in the same way. Cost, transport, opening hours, language, and unspoken expectations can all shape who feels at ease. A useful conversation about a neighbourhood therefore begins with listening to people who seldom appear in its most visible spaces. Their absence may reveal a barrier that regular visitors have stopped noticing."],
      ["paragraph", "There can also be competing needs. A quiet reader and a lively group of children may share the same library. Dog walkers and people who fear dogs may use the same park. A thoughtful approach does not pretend these differences disappear. It asks how clear agreements, considerate design, and everyday courtesy can make room for more than one kind of use."],
      ["heading", "Start with what is already there"],
      ["paragraph", "Before imagining a new community centre, it may be worth looking carefully at existing places. Which spaces are well used? Which are difficult to reach? Where do people already gather, despite a lack of seating or shelter? Small improvements guided by those observations can begin a practical discussion about what residents need."],
      ["paragraph", "The question is not simply how to bring more people into one location. It is how to make everyday life less isolating and more welcoming. Think of a place where you feel comfortable lingering. What makes that possible, and whose experience of the same place might be different from yours?"]
    ]
  },
  {
    slug: "learning-to-ask-better-questions",
    title: "Learning begins with a better question",
    excerpt: "Beyond finding the right answer lies another skill: knowing what is worth asking in the first place.",
    category: "Education",
    publishedAt: "2026-09-14",
    body: [
      ["paragraph", "A question can close a conversation or open one. Asking for a date may help establish a fact. Asking why that date became important invites a different kind of work. Neither question is inherently better; each serves a purpose. The challenge in learning is to recognise when we need certainty and when we need space to explore."],
      ["paragraph", "In an imagined classroom, a group reads a short account of a local decision. At first, the task seems simple: identify what happened. Then someone asks whose account is missing. The text has not changed, but the conversation has. Learners now have to consider perspective, evidence, and the limits of what is available to them."],
      ["heading", "From recall to curiosity"],
      ["paragraph", "Remembering information gives us material to think with. Curiosity helps us decide what to do with it. A productive question often connects the two. What do we already know? What is being assumed? What would help us distinguish between two possible explanations? These prompts slow down the rush toward a neat answer without suggesting that every answer is equally plausible."],
      ["paragraph", "This approach can fit into small moments. After reading an article, write down one point that was clear and one that needs more explanation. Before disagreeing with a classmate, try describing the reasoning behind their view. While reviewing a project, ask what surprised the team rather than only whether it reached its target. Each habit makes a little more room for learning."],
      ["quote", "A useful question gives thought somewhere to go."],
      ["heading", "The courage to be uncertain"],
      ["paragraph", "People are not equally comfortable asking questions in public. A learner may worry that a question sounds obvious, that it interrupts the lesson, or that it exposes something everyone else understands. A welcoming environment makes uncertainty ordinary. It allows someone to say that they need an example or that an explanation does not yet make sense."],
      ["paragraph", "That does not mean every discussion must remain open forever. Learning also involves making a judgment with the information available, while being honest about its limits. A teacher can model this by explaining why one interpretation is better supported and what new evidence might change that view. Confidence and openness can exist together."],
      ["heading", "Take the question beyond the classroom"],
      ["paragraph", "The habit of asking carefully travels well. It can improve a conversation at work, help us understand a public announcement, or make us pause before sharing a striking claim. In each case, a useful first step is to separate what is directly known from what has been inferred. The next step is to ask what remains uncertain."],
      ["paragraph", "For your next reading session, keep a small question log. Record what you wonder about before reading and what you wonder about afterward. The change between those lists may say something valuable about what you learned. Which question has recently helped you see a familiar subject differently?"]
    ]
  },
  {
    slug: "what-we-keep-when-we-tell-our-stories",
    title: "What we keep when we tell our stories",
    excerpt: "The recipes, sayings and everyday rituals that carry a sense of home from one generation to the next.",
    category: "Culture",
    publishedAt: "2026-09-11",
    body: [
      ["paragraph", "A family recipe may arrive without measurements. A little of this, enough of that, and a description of how the mixture should feel. To someone learning it for the first time, those directions can seem incomplete. To the person teaching, they may contain years of practice and a memory of the person who taught them."],
      ["paragraph", "Everyday stories work in a similar way. They carry knowledge through details that do not always fit into a formal record. A saying can preserve a sense of humour. The name of a place can recall a journey. A familiar ritual can connect people who now live far apart. These observations are invitations to reflect, not claims that every family or culture shares the same experience."],
      ["heading", "Memory is a conversation"],
      ["paragraph", "Telling a story also means choosing. We decide where to begin, which details to include, and what a listener needs to understand. Another person may remember the same event differently. Rather than treating those differences only as errors, we can ask what each account makes visible. Listening carefully does not require us to give up questions about accuracy."],
      ["quote", "A story can be an inheritance and an invitation at the same time."],
      ["heading", "Make space for another telling"],
      ["paragraph", "Preserving a story need not mean keeping it untouched. A younger person may translate a phrase, adapt a recipe, or ask about a detail that others have taken for granted. Those changes can become part of the record too. What matters is an honest account of where a story came from and respect for the people whose experiences it holds."],
      ["paragraph", "A simple starting point is to ask someone about an ordinary object they have kept. Let the conversation follow what matters to them, and ask permission before recording or sharing it. You may discover that the object's value is not in its age or price, but in a relationship it makes possible to remember. What everyday story would you like to carry forward?"]
    ]
  },
  {
    slug: "making-room-for-uncertainty",
    title: "Making room for uncertainty",
    excerpt: "Why changing our minds can be a sign of careful thinking rather than a failure of conviction.",
    category: "Philosophy",
    publishedAt: "2026-09-09",
    body: [
      ["paragraph", "We often admire a clear answer. It makes a discussion easier to follow and a decision easier to make. But clarity can come from two very different places: a careful consideration of the evidence, or a refusal to consider anything that might complicate a view. From the outside, the two can sound remarkably alike."],
      ["heading", "Hold a view, leave a door open"],
      ["paragraph", "Being uncertain does not require us to suspend every judgment. We can choose a course of action while admitting that some details remain unknown. We can defend a position while naming the conditions under which we would reconsider it. This makes our reasoning more visible to others and gives disagreement something specific to work with."],
      ["paragraph", "Imagine a neighbourhood group deciding how to use a shared room. One proposal seems strongest, but nobody knows whether its opening hours would suit residents who work late. A provisional decision, followed by a genuine review, may be more useful than pretending the question is settled. The example is invented; the habit of acknowledging a missing perspective is widely applicable."],
      ["quote", "Leaving room to revise a view is part of taking that view seriously."],
      ["heading", "Disagreement as an opportunity"],
      ["paragraph", "A helpful conversation asks more than whether someone agrees. It asks which part of a claim they question and why. Perhaps the disagreement concerns a fact, perhaps a priority, or perhaps the meaning of a word. Separating these possibilities can turn a broad argument into a more manageable exchange."],
      ["paragraph", "We may still end up disagreeing. The value of the conversation is not always a shared conclusion. Sometimes it is a clearer understanding of the reasons on each side. Think of a view you have revised. What made that revision possible, and how could you offer someone else the same room to think?"]
    ]
  },
  {
    slug: "progress-at-a-human-scale",
    title: "What does progress look like at a human scale?",
    excerpt: "Looking beyond the big announcement to the small changes that make everyday life more workable.",
    category: "Development",
    publishedAt: "2026-09-06",
    body: [
      ["paragraph", "A new building makes a clear photograph. A shorter wait, an easier journey, or a service that finally opens on time is harder to capture in one image. Yet these small changes can matter deeply to the people who experience them. Thinking about development at a human scale begins by asking what becomes easier in an ordinary day."],
      ["heading", "Begin with the daily journey"],
      ["paragraph", "Consider an illustrative example of a community centre that offers useful services but is difficult to reach. The building may be well equipped, while a missing footpath still prevents some residents from using it. Listening to their journeys can reveal a need that an inventory of equipment would miss. The point is not to dismiss large projects, but to connect them to the lives they are meant to support."],
      ["quote", "A useful measure of progress is whether more people can take part in everyday life."],
      ["heading", "Ask what lasts"],
      ["paragraph", "Opening something is only the beginning. Maintenance, clear information, and reliable staffing influence what happens afterward. These practical details may attract less attention, but they help turn an initial promise into a dependable service. They also offer concrete questions for public discussion: who looks after this, how will concerns be heard, and what happens when something breaks?"],
      ["paragraph", "Different residents may have different priorities. A thoughtful process makes those differences visible instead of assuming that one improvement benefits everyone equally. It also returns to people after a change has been made. Did the proposed solution solve the problem they described? Did it create another difficulty?"],
      ["paragraph", "There is room for ambition in this approach. Its starting point is simply more specific. Name the experience that should improve, listen to the people involved, and look again after the work is done. What small change in your area would make a meaningful difference to an ordinary day?"]
    ]
  },
  {
    slug: "the-value-of-slow-reading",
    title: "The quiet value of reading slowly",
    excerpt: "Not every page needs to be finished quickly. Some ideas ask us to linger, reread and return.",
    category: "Education",
    publishedAt: "2026-09-03",
    body: [
      ["paragraph", "Finishing a book can feel like an achievement. Yet the passage we return to months later is often one we did not understand immediately. Slow reading gives that kind of encounter some space. It asks less about how far we have travelled through a text and more about what we have noticed along the way."],
      ["heading", "Read with a pencil, or a question"],
      ["paragraph", "One way to slow down is to write a short note after a paragraph: what is being claimed here? Another is to mark a word whose meaning seems important and follow how it is used. Neither practice needs to become a rigid routine. The purpose is to stay in conversation with the text rather than simply move across it."],
      ["paragraph", "Different reading situations call for different speeds. Looking up an opening time is not the same as reading an essay about justice. Skimming can be useful, and careful reading can be tiring. A deliberate reader chooses a pace that fits the purpose, then allows that pace to change when a passage deserves more attention."],
      ["quote", "Sometimes the most useful part of reading is the moment we stop."],
      ["heading", "Leave room for a second encounter"],
      ["paragraph", "Returning to a familiar text can also reveal changes in ourselves. An example that once seemed distant may become recognisable after a new experience. A confident argument may appear less convincing when we have heard another perspective. The words remain the same, but the conversation has moved."],
      ["paragraph", "Choose one short piece this week and read it twice, with a little time between readings. Notice what seems different the second time. This is a simple reflection exercise rather than a guaranteed method for learning. Which sentence would you bring to a discussion, and what would you want to ask about it?"]
    ]
  },
  {
    slug: "a-better-kind-of-disagreement",
    title: "Towards a better kind of disagreement",
    excerpt: "A thoughtful public conversation begins with the willingness to understand before responding.",
    category: "Society",
    publishedAt: "2026-09-01",
    body: [
      ["paragraph", "A discussion can change direction with one sentence. A sincere question may open it up. An assumption about another person's motives may close it down. We cannot control every response, but we can choose whether our own contribution makes an idea easier to examine or a person harder to hear."],
      ["heading", "Be specific about the difference"],
      ["paragraph", "Before replying, it can help to name the exact claim you disagree with. Does the evidence seem incomplete? Is the proposed solution unlikely to work? Are you placing a different value on the outcome? A specific disagreement gives the other person something they can answer. A broad dismissal often leaves little room for a useful response."],
      ["quote", "Respect does not require agreement. It requires taking another person seriously."],
      ["heading", "Curiosity has boundaries"],
      ["paragraph", "Listening carefully is not an obligation to accept abuse or repeat harmful claims without examination. A healthy discussion needs clear expectations about how people treat one another. Moderation can protect the conditions for participation while still allowing difficult questions and sharply different views."],
      ["paragraph", "An imagined exchange between two neighbours about a noisy shared space might begin with blame. It could become more useful if each describes the particular difficulty they face and the times when it matters most. The disagreement may remain, but a practical adjustment becomes easier to imagine. This example illustrates a possibility, not a promise that every conflict has a simple solution."],
      ["paragraph", "The next time an article prompts a strong response, try drafting a comment that includes one clear point, a reason, and an open question. Read it once as if you were the person receiving it. Does it invite a reply you would be willing to consider? That small pause can be a worthwhile part of public conversation."]
    ]
  }
];

export const articles: Article[] = seeds.map(({ body, featured = false, ...article }, index) => ({
  ...article,
  id: String(index + 1),
  author: "The Insight Journal",
  featured,
  content: body.map(([type, text]) => ({ type, text })),
  readingTime: Math.max(1, Math.ceil(body.reduce((words, [, text]) => words + text.split(/\s+/).length, 0) / 200)),
}));

export function getArticle(slug: string) {
  return articles.find((article) => article.slug === slug);
}

export function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(date));
}
