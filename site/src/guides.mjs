export const guides = [
  {
    slug: 'what-to-do-while-your-coding-agent-runs',
    title: 'What can I do while my coding agent is working?',
    short: 'Take a puzzle break while your agent codes',
    description: 'Try a puzzle you can leave the moment the code is ready. See what Fokus saved when we left a Minesweeper board and reopened it on Mac.',
    answer: 'Pick a break that fits an unpredictable wait. In Fokus for Mac, you can work out a few moves on a puzzle while the sites you usually scroll stay blocked. When there’s code to review, leave the board right there. Fokus saves each move.',
    steps: [
      ['Leave yourself a place to come back to', 'Suppose your agent is fixing a failing keyboard test. Keep the test open in your editor before sending the prompt. When the change is ready, you already know where to look.'],
      ['Make one move', 'Start a Fokus session with your Social media group enabled. Open Activities, choose Minesweeper and reveal a square. Use the numbers on the board to decide where a mine belongs, then place a flag. Your site blocks stay active.'],
      ['Go back to the code', 'Switch to your editor as soon as you want to check the fix. The next time you have a wait, open Activities and choose Resume board under Minesweeper. Your last flag is still there.']
    ],
    image: 'agent-break.jpg',
    caption: 'The board we left mid-game. One flag is down and seven are still available.',
    proofTitle: 'What survived the switch back to work?',
    proof: 'We played a fixed board in the Fokus interface with its Mac blocker running. The opening move revealed 47 squares. We flagged one mine, switched to Overview, then resumed the board from Activities.',
    columns: ['Board state', 'Revealed squares', 'Placed flags'],
    rows: [['Before switching away', '47', '1'], ['After resuming', '47', '1']],
    limit: 'The Mac helper still listed Reddit, X and Instagram after we resumed the board. You decide when to switch back. Fokus runs independently of your coding agent.',
    link: 'Try a puzzle in your browser', href: '/#whats-new', date: '2026-11-09'
  },
  {
    slug: 'temporarily-unblock-one-website',
    title: 'How do I unblock one website for five minutes on Mac?',
    image: 'mac-site-exception.jpg',
    caption: 'Reddit is open until 6:42 PM. The locks beside X and Instagram show that their blocks are still active.',
    short: 'Open one blocked site for five minutes',
    description: 'Open a Reddit thread during a Fokus session on Mac. See which rules change, which sites stay blocked and what happens when the five minutes end.',
    answer: 'In an active Fokus session, open Overview, expand the group and click Unblock beside reddit.com. Choose 5 min. Reddit opens for the lookup, X and Instagram stay blocked, and Fokus restores the Reddit rule when time runs out.',
    steps: [
      ['Start a session with three sites', 'In Groups, enable a group containing reddit.com, x.com and instagram.com. Turn on blocking and approve the local Mac helper. If you are outside working hours, choose Start session and allow at least ten minutes for this example.'],
      ['Give Reddit five minutes', 'Expand the group in Overview. Click the lock beside reddit.com and choose 5 min. The count falls from three blocked sites to two. Reddit now shows the time its block will return.'],
      ['Finish the lookup', 'Let the timer expire, or select the time beside Reddit and choose Block now to finish early. A site exception ends by the end of the session.']
    ],
    proofTitle: 'Which sites opened during the lookup?',
    columns: ['Stage', 'reddit.com', 'x.com', 'instagram.com'],
    rows: [['Session starts','Blocked','Blocked','Blocked'],['Five-minute exception','Open','Blocked','Blocked'],['Timer ends','Blocked','Blocked','Blocked']],
    proof: 'We ran the packaged 0.4.0 Mac helper for ten minutes with a disposable hosts file. Both reddit.com and its old.reddit.com alias left the file during the exception. X and Instagram stayed on the list throughout. At expiry, both Reddit entries returned.',
    limit: 'The helper changes how your Mac resolves hostnames. A cached page or an existing connection may stay open after a rule changes. Close and reopen the tab to check a fresh connection. Browsers that resolve names through a remote proxy can bypass hosts rules.',
    link: 'Try the five-minute example', href: '/#sample', date: '2026-11-09'
  },
  {
    slug: 'block-websites-during-working-hours',
    title: 'How do I block websites only during working hours on Mac?',
    image: 'mac-working-hours.jpg',
    caption: 'This schedule runs from 9 AM to 5 PM, Monday through Friday, in the Mac’s local time zone.',
    short: 'Block sites on a work schedule',
    description: 'Set the weekdays and hours for a Mac website block. Follow a nine-to-five example and see which rules the Fokus helper removes at the end of the day.',
    answer: 'Open Working hours in Fokus for Mac and turn on Scheduled blocking. Select the days, enter the start and end times, then choose Save hours. Enabled groups follow this schedule in your Mac’s local time zone.',
    steps: [
      ['Choose your sites', 'In Groups, enable the list you want blocked at work. For this example use Social media, which includes Reddit, X and Instagram.'],
      ['Set the start and end of your shift', 'Select Monday through Friday in Working hours. Set Start time to 9:00 AM and End time to 5:00 PM, then save. For an overnight shift, enter an end time on the following morning.'],
      ['Check Overview at the end of the day', 'Enable blocking and approve the local helper. During work hours, Overview shows how many sites are blocked and when the session ends. Afterward it shows Off the clock, unless you started a separate timed session.']
    ],
    proofTitle: 'What happens at the end of a shift?',
    columns: ['Schedule state', 'Selected sites blocked'],
    rows: [['Before the schedule','0 of 3'],['During work hours','3 of 3'],['After work hours','0 of 3']],
    proof: 'We set a one-minute shift on our test Mac. The 0.4.0 helper added all three domains to a disposable hosts file at the start. At the end, only the file’s original localhost entry remained.',
    limit: 'One recurring schedule applies to the enabled groups in this preview. For Mac-wide downtime, Apple also offers System Settings → Screen Time → Downtime.',
    source: ['Apple’s Screen Time instructions for Mac','https://support.apple.com/en-gb/guide/mac-help/mchlfafa9773/26/mac/26'],
    link: 'Try setting your working hours', href: '/#working-hours', date: '2026-11-09'
  }
];
