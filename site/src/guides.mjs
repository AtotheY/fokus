export const guides = [
  {
    slug: 'what-to-do-while-your-coding-agent-runs',
    title: 'What can I do while my coding agent is working?',
    short: 'Take a break between prompts',
    description: 'Try a Minesweeper board you can leave mid-game while Claude Code, Cursor or Codex runs. Keep distracting sites blocked on your Mac and resume the same board later.',
    answer: 'If you want a short break, pick something you can put down mid-move. In Fokus for Mac, keep your usual feed sites blocked and open Minesweeper from Activities. As soon as your agent has a diff to review, switch back to your editor. The board saves after each move.',
    steps: [
      ['Give the run a clear finish line', 'For example, ask your agent to fix a failing keyboard test. Before you send the prompt, leave that test open in your editor. When you come back, you know exactly what to check.'],
      ['Keep the feeds on your blocklist', 'Enable your Social media group in Fokus and start a blocking session. Open Activities, choose Minesweeper, then reveal a square or flag a mine. The block stays active while you play.'],
      ['Leave the board mid-game', 'When the diff is ready, switch back to the failing test. On your next wait, open Activities and choose Resume board under Minesweeper. The squares and flags are where you left them.']
    ],
    image: 'agent-break.jpg',
    caption: 'Our sample board after one reveal and one flag. Seven flags remain. This is the board we left and resumed.',
    proofTitle: 'The same board on the next run',
    proof: 'We ran the Fokus app interface against its Mac blocker using three test domains and a fixed board. One opening revealed 47 squares. We flagged a mine, left Activities, and reopened the game with Resume board.',
    columns: ['In the test', 'Revealed squares', 'Placed flags'],
    rows: [['Before leaving', '47', '1'], ['After resuming', '47', '1']],
    limit: 'The Mac helper still listed Reddit, X and Instagram after resuming. Switch back when your coding tool finishes. Fokus runs independently of the agent.',
    link: 'Download Fokus for Mac', href: '/download/', date: '2026-11-09'
  },
  {
    slug: 'temporarily-unblock-one-website',
    title: 'How to unblock one website for five minutes on Mac',
    image: 'mac-site-exception.jpg',
    caption: 'Reddit shows Open until 6:42 PM. The two locks below it belong to X and Instagram.',
    short: 'Open one site for five minutes',
    description: 'Give Reddit a timed exception in Fokus while X and Instagram stay blocked. The Mac helper puts Reddit back on the list when time runs out.',
    answer: 'During an active Fokus session on Mac, expand a group in Overview, click Unblock beside reddit.com and choose 5 min. Only Reddit and its covered aliases open. X and Instagram stay blocked, and the helper restores the Reddit rule when the timer expires.',
    steps: [
      ['Start with a small list', 'In Groups, put reddit.com, x.com and instagram.com in an enabled group. Enable blocking and approve the Mac helper. Outside working hours, use Start session and choose at least ten minutes.'],
      ['Open the site you need', 'In Overview, expand the group and use the lock beside reddit.com. Choose 5 min. The count drops from three sites to two, and the Reddit row shows Open until with the return time.'],
      ['Return to the block', 'Let the five minutes pass, or click the time chip and choose Block now to finish early. A break that would run past the session ends with the session.']
    ],
    proofTitle: 'One Reddit lookup, three rules to check',
    columns: ['Helper state','reddit.com','x.com','instagram.com'],
    rows: [['Session begins','Blocked','Blocked','Blocked'],['5 min selected','Open','Blocked','Blocked'],['Timer expires','Blocked','Blocked','Blocked']],
    proof: 'We ran the packaged 0.4.0 Mac helper with a disposable hosts file and a ten-minute session. During the five-minute exception both reddit.com and old.reddit.com disappeared from its rules. The X and Instagram entries stayed in place. When the timer expired, the Reddit entries returned.',
    limit: 'The helper changes hostname resolution. A cached page or an existing connection can survive a rule change. Close and reopen the tab to check a fresh connection. A browser using remote proxy resolution can bypass these rules.',
    link: 'Try the three-site example', href: '/#sample', date: '2026-11-09'
  },
  {
    slug: 'block-websites-during-working-hours',
    title: 'How to block websites only during working hours on Mac',
    image: 'mac-working-hours.jpg',
    caption: 'Monday through Friday are selected. Blocking starts at 9 AM and ends at 5 PM in the Mac’s local time zone.',
    short: 'Block sites during working hours',
    description: 'Set a weekday start and end time for selected websites on your Mac, then check what happens at the end of the shift.',
    answer: 'In Fokus for Mac, turn on Scheduled blocking under Working hours, select your weekdays, enter a start and end time, and save. Enabled groups follow that window automatically in your Mac’s local time zone. One schedule applies to the enabled groups.',
    steps: [
      ['Choose what work hours cover', 'Open Groups and enable the group you want. The Social media preset includes Reddit, X and Instagram. Keep your usual browser and existing accounts.'],
      ['Set your workweek', 'Open Working hours. For a nine-to-five week, select Monday through Friday, set Start time to 9:00 AM and End time to 5:00 PM, then click Save hours. Check the time zone shown below the controls.'],
      ['Check the next boundary', 'Enable blocking and approve the local helper once. During the window, Overview shows the blocked count and session end. Outside the window it shows Off the clock unless you have started a separate timed session.']
    ],
    proofTitle: 'Watch a work period end',
    columns: ['Point in the test','Selected sites blocked'],
    rows: [['Before the schedule was enabled','0 of 3'],['Inside the scheduled window','3 of 3'],['After the end time','0 of 3']],
    proof: 'We shortened the schedule to a one-minute window on the test Mac. The 0.4.0 helper added the three domains to a disposable hosts file during that minute. At the end, the file contained its original localhost entry again. The same Working hours controls accept a full shift or a shift that crosses midnight.',
    limit: 'For a general Mac-wide downtime period, Apple also provides System Settings → Screen Time → Downtime. Fokus suits a selected list of sites with a shared work schedule and individual timed exceptions. Separate recurring schedules for different groups are outside this preview.',
    source: ['Apple’s Mac Screen Time guide','https://support.apple.com/en-gb/guide/mac-help/mchlfafa9773/26/mac/26'],
    link: 'Get the Mac preview', href: '/download/', date: '2026-11-09'
  }
];
